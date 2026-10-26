import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Trip } from "@/lib/supabase/types";
import { stripe } from "@/lib/stripe/server";
import { CANCEL_REASON } from "@/lib/trip-status";
import { hostEarningsCents, type DailyPrices } from "@/lib/pricing";
import { notifyTrip, notifyTripLater, type TripEvent } from "@/lib/notify";
import { holdDeposit } from "@/lib/charges";

type TripUpdate = Database["public"]["Tables"]["trips"]["Update"];

/** An unpaid checkout holds the car for this long before others can book it. */
const CHECKOUT_HOLD_MS = 30 * 60 * 1000;

const ACTIVE_STATUSES = '("cancelled_guest","cancelled_host")';

export function isCancelled(status: Trip["status"]) {
  return status === "cancelled_guest" || status === "cancelled_host";
}

/**
 * Trips that still hold their dates: anything not cancelled, except unpaid
 * checkouts older than the hold. Use with `.or()` next to a not-cancelled filter.
 */
export function holdsDates(now = Date.now()) {
  const cutoff = new Date(now - CHECKOUT_HOLD_MS).toISOString();
  return `status.neq.pending,payment_status.not.in.(pending,failed),created_at.gte.${cutoff}`;
}

/** One key for every full refund of a payment, so two code paths can't refund it twice. */
function fullRefund(paymentIntentId: string) {
  return stripe.refunds.create(
    { payment_intent: paymentIntentId },
    { idempotencyKey: `full-refund-${paymentIntentId}` }
  );
}

/**
 * Lets go of a payment the guest shouldn't pay: releases the card hold, or
 * refunds it in full if it was charged in the meantime (say the host accepted
 * at the same moment).
 */
async function releasePayment(paymentIntentId: string | null): Promise<"voided" | "refunded"> {
  if (!paymentIntentId) return "voided";
  try {
    await stripe.paymentIntents.cancel(paymentIntentId);
    return "voided";
  } catch (err) {
    if ((err as Stripe.errors.StripeError).code !== "payment_intent_unexpected_state") throw err;
  }
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status !== "succeeded") return "voided";
  await fullRefund(paymentIntentId);
  return "refunded";
}

async function updateTrip(id: string, update: TripUpdate) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("trips")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Frees dates held by checkouts nobody finished: anything unpaid for over 30
 * minutes, plus this guest's own earlier attempts on the same car.
 */
export async function releaseStaleCheckouts(vehicleId: string, guestId: string) {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - CHECKOUT_HOLD_MS).toISOString();
  const { data: stale } = await admin
    .from("trips")
    .select("id, stripe_payment_intent_id, payment_status")
    .eq("vehicle_id", vehicleId)
    .eq("status", "pending")
    .in("payment_status", ["pending", "failed"])
    .or(`created_at.lt.${cutoff},guest_id.eq.${guestId}`);

  for (const trip of stale ?? []) {
    const released = await releasePayment(trip.stripe_payment_intent_id);
    await updateTrip(trip.id, {
      status: "cancelled_guest",
      payment_status: released === "voided" && trip.payment_status === "failed" ? "failed" : released,
      cancellation_reason: CANCEL_REASON.checkoutNotFinished,
      cancelled_at: new Date().toISOString(),
    });
  }
}

/** True when the car is booked or blocked for any part of [start, end). */
export async function hasConflict(vehicleId: string, start: Date, end: Date) {
  const admin = createAdminClient();
  const [trips, blocks] = await Promise.all([
    admin
      .from("trips")
      .select("id")
      .eq("vehicle_id", vehicleId)
      .not("status", "in", ACTIVE_STATUSES)
      .or(holdsDates())
      .lt("starts_at", end.toISOString())
      .gt("ends_at", start.toISOString())
      .limit(1),
    admin
      .from("vehicle_availability")
      .select("id")
      .eq("vehicle_id", vehicleId)
      .lt("blocked_from", end.toISOString())
      .gt("blocked_to", start.toISOString())
      .limit(1),
  ]);
  if (trips.error) throw trips.error;
  if (blocks.error) throw blocks.error;
  return trips.data.length > 0 || blocks.data.length > 0;
}

/** Booked and blocked ranges for a car, for date pickers. */
export async function unavailableRanges(vehicleId: string) {
  const admin = createAdminClient();
  const [{ data: trips }, { data: blocks }] = await Promise.all([
    admin
      .from("trips")
      .select("starts_at, ends_at")
      .eq("vehicle_id", vehicleId)
      .not("status", "in", ACTIVE_STATUSES)
      .or(holdsDates())
      .gt("ends_at", new Date().toISOString()),
    admin
      .from("vehicle_availability")
      .select("blocked_from, blocked_to")
      .eq("vehicle_id", vehicleId)
      .gt("blocked_to", new Date().toISOString()),
  ]);
  return [
    ...(trips ?? []).map((t) => ({ from: t.starts_at, to: t.ends_at })),
    ...(blocks ?? []).map((b) => ({ from: b.blocked_from, to: b.blocked_to })),
  ];
}

/**
 * Brings a trip in line with its PaymentIntent. Safe to call more than once,
 * so both the webhook and the checkout page use it.
 */
export async function applyPaymentIntent(pi: Stripe.PaymentIntent) {
  const admin = createAdminClient();
  const { data: trip } = await admin
    .from("trips")
    .select("id, status, payment_status")
    .eq("stripe_payment_intent_id", pi.id)
    .maybeSingle();
  if (!trip) return null;

  const now = new Date().toISOString();
  const cancelled = isCancelled(trip.status);
  // The saved card, so charges after the trip can use it.
  const paymentMethod = typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id;
  let update: TripUpdate | null = null;
  let event: TripEvent | null = null;

  switch (pi.status) {
    case "succeeded": {
      if (trip.payment_status === "captured" || trip.payment_status === "refunded") break;
      if (cancelled) {
        // Paid after the trip was called off: give it back.
        await fullRefund(pi.id);
        update = { payment_status: "refunded" };
        break;
      }
      const charge = typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id;
      update = {
        payment_status: "captured",
        stripe_charge_id: charge ?? null,
        ...(paymentMethod ? { stripe_payment_method_id: paymentMethod } : {}),
        ...(trip.status === "pending" ? { status: "approved" as const, approved_at: now } : {}),
      };
      // A held card being charged means the host accepted; otherwise it was instant book.
      if (trip.status === "pending") event = trip.payment_status === "authorized" ? "accepted" : "booked";
      break;
    }
    case "requires_capture": {
      if (cancelled) {
        update = { payment_status: await releasePayment(pi.id) };
      } else if (trip.payment_status === "pending" || trip.payment_status === "failed") {
        update = {
          payment_status: "authorized",
          ...(paymentMethod ? { stripe_payment_method_id: paymentMethod } : {}),
        };
        event = "requested";
      }
      break;
    }
    case "canceled": {
      if (trip.status === "pending") {
        const expired = pi.cancellation_reason === "automatic";
        update = {
          status: expired ? "cancelled_host" : "cancelled_guest",
          payment_status: "voided",
          cancellation_reason: expired ? CANCEL_REASON.hostMissed : CANCEL_REASON.paymentCancelled,
          cancelled_at: now,
        };
        if (expired && trip.payment_status === "authorized") event = "expired";
      } else if (trip.payment_status === "pending" || trip.payment_status === "authorized") {
        update = { payment_status: "voided" };
      }
      break;
    }
    case "requires_payment_method": {
      if (pi.last_payment_error && trip.status === "pending" && trip.payment_status === "pending") {
        update = {
          status: "cancelled_guest",
          payment_status: "failed",
          cancellation_reason: CANCEL_REASON.paymentFailed,
          cancelled_at: now,
        };
      }
      break;
    }
  }

  if (update) await updateTrip(trip.id, update);
  // Both the webhook and the page can get here for one change; the notice is sent once.
  if (event) notifyTripLater(trip.id, event);
  return { ...trip, ...update };
}

type MoneyTrip = Pick<Trip, "id" | "payment_status" | "stripe_payment_intent_id">;

/**
 * Releases a card hold, or refunds up to `refundCents` of a captured payment.
 * Returns the payment status to store.
 */
export async function settleCancellation(
  trip: MoneyTrip,
  refundCents: number
): Promise<Trip["payment_status"]> {
  if (trip.payment_status === "pending" || trip.payment_status === "authorized") {
    return releasePayment(trip.stripe_payment_intent_id);
  }
  if (trip.payment_status === "captured" && refundCents > 0 && trip.stripe_payment_intent_id) {
    await stripe.refunds.create(
      { payment_intent: trip.stripe_payment_intent_id, amount: refundCents },
      { idempotencyKey: `cancel-${trip.id}` }
    );
    return "refunded";
  }
  return trip.payment_status;
}

interface PayoutTrip {
  id: string;
  host_id: string;
  subtotal_cents: number;
  stripe_charge_id: string | null;
}

/**
 * Transfers the host's share of a completed trip to their Stripe Connect
 * account and marks it paid out. Idempotent — Stripe deduplicates on the
 * idempotency key. False when the host has no bank to pay yet.
 */
async function payoutHost(trip: PayoutTrip): Promise<boolean> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", trip.host_id)
    .single();

  if (!profile?.stripe_account_id) return false; // host hasn't connected their bank yet

  const amount = hostEarningsCents(trip.subtotal_cents);
  if (amount > 0) {
    await stripe.transfers.create(
      {
        amount,
        currency: "usd",
        destination: profile.stripe_account_id,
        transfer_group: trip.id,
        ...(trip.stripe_charge_id ? { source_transaction: trip.stripe_charge_id } : {}),
      },
      { idempotencyKey: `payout-${trip.id}` }
    );
  }
  await updateTrip(trip.id, { paid_out_at: new Date().toISOString() });
  return true;
}

export interface SettleResult {
  completed: number;
  started: number;
  expired: number;
  paidOut: number;
}

const PAYOUT_SELECT = "id, host_id, subtotal_cents, stripe_charge_id";

/**
 * Moves trips along as time passes: paid trips start and finish, requests
 * nobody answered before pick-up are dropped, and so are checkouts that never
 * got paid. `scope` is an `.or()` filter that limits it to someone's trips.
 * Each update only returns the rows it changed, so two runs at once can't
 * both act on a trip.
 */
async function settle(scope: string | null): Promise<SettleResult> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const scoped = <Q extends { or: (filter: string) => Q }>(query: Q) => (scope ? query.or(scope) : query);
  const result: SettleResult = { completed: 0, started: 0, expired: 0, paidOut: 0 };

  const { data: completed } = await scoped(
    admin
      .from("trips")
      .update({ status: "completed", completed_at: now, updated_at: now })
      .in("status", ["approved", "active"])
      .eq("payment_status", "captured")
      .lte("ends_at", now)
  ).select("id");
  for (const trip of completed ?? []) notifyTripLater(trip.id, "completed");
  result.completed = completed?.length ?? 0;

  // Pay hosts for finished trips, including ones an earlier run couldn't pay
  // (no bank connected yet, or Stripe was down). Trips completed before
  // completed_at existed were paid by the old code, so they're left alone.
  const { data: unpaid } = await scoped(
    admin
      .from("trips")
      .select(PAYOUT_SELECT)
      .eq("status", "completed")
      .eq("payment_status", "captured")
      .not("completed_at", "is", null)
      .is("paid_out_at", null)
  );
  const payouts = await Promise.allSettled((unpaid ?? []).map(payoutHost));
  for (const p of payouts) if (p.status === "rejected") console.error("[payout]", p.reason);
  result.paidOut = payouts.filter((p) => p.status === "fulfilled" && p.value).length;

  const { data: started } = await scoped(
    admin
      .from("trips")
      .update({ status: "active", updated_at: now })
      .eq("status", "approved")
      .eq("payment_status", "captured")
      .lte("starts_at", now)
  ).select("id");
  // holdDeposit never throws, so one card can't stop the rest.
  await Promise.all((started ?? []).map((t) => holdDeposit(t.id)));
  result.started = started?.length ?? 0;

  const { data: lapsed } = await scoped(
    admin
      .from("trips")
      .select("id, payment_status, stripe_payment_intent_id")
      .eq("status", "pending")
      .lte("starts_at", now)
  );

  for (const trip of lapsed ?? []) {
    const wasRequest = trip.payment_status === "authorized";
    try {
      const released = await releasePayment(trip.stripe_payment_intent_id);
      await updateTrip(trip.id, {
        status: wasRequest ? "cancelled_host" : "cancelled_guest",
        payment_status: released === "voided" && trip.payment_status === "failed" ? "failed" : released,
        cancellation_reason: wasRequest ? CANCEL_REASON.hostMissed : CANCEL_REASON.checkoutNotFinished,
        cancelled_at: now,
      });
    } catch (err) {
      // Left pending, so the next run tries again.
      console.error("[settle] couldn't close", trip.id, err);
      continue;
    }
    if (wasRequest) {
      notifyTripLater(trip.id, "expired");
      result.expired++;
    }
  }

  return result;
}

/** Settles one person's trips, as a guest or a host. Pages call this on load. */
export function settleTripStatuses(userId: string) {
  return settle(`guest_id.eq.${userId},host_id.eq.${userId}`);
}

/** Settles every trip. The cron calls this. */
export function settleAllTrips() {
  return settle(null);
}

const HOUR = 60 * 60 * 1000;

/**
 * Cron: reminds guests and hosts about pick-ups in the next day and guests
 * about returns in the next 3 hours. Each trip is claimed before the notice
 * goes out, so it's only reminded once.
 */
export async function sendTripReminders() {
  const admin = createAdminClient();
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();

  const { data: pickups } = await admin
    .from("trips")
    .update({ pickup_reminded_at: iso(now) })
    .eq("status", "approved")
    .eq("payment_status", "captured")
    .is("pickup_reminded_at", null)
    .gt("starts_at", iso(now))
    .lte("starts_at", iso(now + 24 * HOUR))
    .select("id");

  const { data: returns } = await admin
    .from("trips")
    .update({ return_reminded_at: iso(now) })
    .in("status", ["approved", "active"])
    .eq("payment_status", "captured")
    .is("return_reminded_at", null)
    .gt("ends_at", iso(now))
    .lte("ends_at", iso(now + 3 * HOUR))
    .select("id");

  await Promise.all([
    ...(pickups ?? []).map((t) => notifyTrip(t.id, "pickup_soon")),
    ...(returns ?? []).map((t) => notifyTrip(t.id, "return_soon")),
  ]);
  return { pickups: pickups?.length ?? 0, returns: returns?.length ?? 0 };
}

/** Charges a held card when the host accepts a request. */
export async function capturePayment(trip: MoneyTrip) {
  if (!trip.stripe_payment_intent_id) throw new Error("Trip has no payment");
  return stripe.paymentIntents.capture(trip.stripe_payment_intent_id);
}

/**
 * A car's own day prices from fromKey on, and before untilKey when given. Read with the
 * admin client so the car page, checkout and the checkout API all price from the same rows.
 */
export async function loadDailyPrices(
  vehicleId: string,
  fromKey: string,
  untilKey?: string
): Promise<DailyPrices> {
  let query = createAdminClient()
    .from("vehicle_daily_prices")
    .select("date, price_cents")
    .eq("vehicle_id", vehicleId)
    .gte("date", fromKey);
  if (untilKey) query = query.lt("date", untilKey);
  const { data } = await query;
  return Object.fromEntries((data ?? []).map((row) => [row.date, row.price_cents]));
}
