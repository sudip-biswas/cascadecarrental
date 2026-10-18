import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Trip } from "@/lib/supabase/types";
import { stripe } from "@/lib/stripe/server";
import { CANCEL_REASON } from "@/lib/trip-status";
import { hostEarningsCents } from "@/lib/pricing";

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
  let update: TripUpdate | null = null;

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
        ...(trip.status === "pending" ? { status: "approved" as const, approved_at: now } : {}),
      };
      break;
    }
    case "requires_capture": {
      if (cancelled) {
        update = { payment_status: await releasePayment(pi.id) };
      } else if (trip.payment_status === "pending" || trip.payment_status === "failed") {
        update = { payment_status: "authorized" };
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

/**
 * Transfers the host's share of a completed trip to their Stripe Connect
 * account. Idempotent — Stripe deduplicates on the idempotency key.
 */
async function payoutHost(trip: {
  id: string;
  host_id: string;
  subtotal_cents: number;
  stripe_charge_id: string | null;
}) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", trip.host_id)
    .single();

  if (!profile?.stripe_account_id) return; // host hasn't connected their bank yet

  const amount = hostEarningsCents(trip.subtotal_cents);
  if (amount <= 0) return;

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

/**
 * Moves a person's trips along as time passes: paid trips start and finish,
 * requests nobody answered before pick-up are dropped, and so are checkouts
 * that never got paid.
 */
export async function settleTripStatuses(userId: string) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const mine = `guest_id.eq.${userId},host_id.eq.${userId}`;

  // Fetch trips to complete so we can trigger payouts after the status update
  const { data: toComplete } = await admin
    .from("trips")
    .select("id, host_id, subtotal_cents, stripe_charge_id")
    .in("status", ["approved", "active"])
    .eq("payment_status", "captured")
    .lte("ends_at", now)
    .or(mine);

  if (toComplete?.length) {
    await admin
      .from("trips")
      .update({ status: "completed", updated_at: now })
      .in("id", toComplete.map((t) => t.id));

    // Fire payouts in the background; errors are non-fatal
    await Promise.allSettled(toComplete.map(payoutHost));
  }

  await admin
    .from("trips")
    .update({ status: "active", updated_at: now })
    .eq("status", "approved")
    .eq("payment_status", "captured")
    .lte("starts_at", now)
    .or(mine);

  const { data: lapsed } = await admin
    .from("trips")
    .select("id, payment_status, stripe_payment_intent_id")
    .eq("status", "pending")
    .lte("starts_at", now)
    .or(mine);

  for (const trip of lapsed ?? []) {
    const wasRequest = trip.payment_status === "authorized";
    const released = await releasePayment(trip.stripe_payment_intent_id);
    await updateTrip(trip.id, {
      status: wasRequest ? "cancelled_host" : "cancelled_guest",
      payment_status: released === "voided" && trip.payment_status === "failed" ? "failed" : released,
      cancellation_reason: wasRequest ? CANCEL_REASON.hostMissed : CANCEL_REASON.checkoutNotFinished,
      cancelled_at: now,
    });
  }
}

/** Charges a held card when the host accepts a request. */
export async function capturePayment(trip: MoneyTrip) {
  if (!trip.stripe_payment_intent_id) throw new Error("Trip has no payment");
  return stripe.paymentIntents.capture(trip.stripe_payment_intent_id);
}
