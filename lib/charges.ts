import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TripCharge } from "@/lib/supabase/types";
import { stripe } from "@/lib/stripe/server";
import { notify, notifyTrip } from "@/lib/notify";
import { formatCurrency } from "@/lib/utils";

const DAY_MS = 86_400_000;

/** Hosts can send charges for this long after the trip ends. */
export const CHARGE_WINDOW_DAYS = 7;
/** A charge the guest doesn't answer is collected after this long. */
const AUTO_CHARGE_DAYS = 3;
/** The deposit hold is let go this long after the trip ends, if nothing is open. */
const DEPOSIT_RELEASE_HOURS = 48;

export type ChargeResult = { ok: true; fromDeposit: boolean } | { ok: false; error: string };

/**
 * Whether the host can send a charge now: completed trips for 7 days after the
 * return, and active trips for tolls only (they show up mid-trip).
 */
export function chargeWindow(
  trip: { status: string; ends_at: string },
  now = new Date()
): { open: boolean; activeOnly: boolean; closesAt: Date } {
  const closesAt = new Date(new Date(trip.ends_at).getTime() + CHARGE_WINDOW_DAYS * DAY_MS);
  if (trip.status === "active") return { open: true, activeOnly: true, closesAt };
  return { open: trip.status === "completed" && now < closesAt, activeOnly: false, closesAt };
}

/** A failure reason short enough to show the guest and the host. */
function failureReason(err: unknown): string {
  const e = err as Stripe.errors.StripeError | undefined;
  if (e?.type === "StripeCardError") {
    if (e.code === "authentication_required") return "The bank wants the guest to confirm this payment, so it couldn't go through automatically.";
    return e.message ? `The card on file was declined: ${e.message}` : "The card on file was declined.";
  }
  if (e?.type === "StripeAuthenticationError" || e?.type === "StripePermissionError") {
    return "Payments aren't available right now. Try again later.";
  }
  if (err instanceof Error && !e?.type) return err.message;
  return "The payment didn't go through. Try again later.";
}

/** The PaymentIntent a failed off-session confirm left behind, if any. */
function failedIntentId(err: unknown): string | null {
  return (err as Stripe.errors.StripeError | undefined)?.payment_intent?.id ?? null;
}

const latestCharge = (pi: Stripe.PaymentIntent) =>
  (typeof pi.latest_charge === "string" ? pi.latest_charge : pi.latest_charge?.id) ?? null;

/** Who pays and how: the guest's Stripe customer and the card saved on the trip. */
async function loadPayer(tripId: string) {
  const { data } = await createAdminClient()
    .from("trips")
    .select(
      "id, status, guest_id, host_id, deposit_cents, deposit_status, deposit_payment_intent_id, stripe_payment_method_id, guest:profiles!guest_id(stripe_customer_id), host:profiles!host_id(stripe_account_id), vehicle:vehicles(year, make, model)"
    )
    .eq("id", tripId)
    .maybeSingle();
  return data as unknown as
    | {
        id: string;
        status: string;
        guest_id: string;
        host_id: string;
        deposit_cents: number;
        deposit_status: "none" | "held" | "released" | "captured" | "failed";
        deposit_payment_intent_id: string | null;
        stripe_payment_method_id: string | null;
        guest: { stripe_customer_id: string | null } | null;
        host: { stripe_account_id: string | null } | null;
        vehicle: { year: number; make: string; model: string } | null;
      }
    | null;
}

/** Places the car's security deposit hold when a trip starts. Never throws. */
export async function holdDeposit(tripId: string): Promise<void> {
  const admin = createAdminClient();
  try {
    const trip = await loadPayer(tripId);
    if (!trip || trip.deposit_cents <= 0 || trip.deposit_status !== "none") return;
    if (trip.status !== "approved" && trip.status !== "active") return;

    const customer = trip.guest?.stripe_customer_id;
    if (!customer || !trip.stripe_payment_method_id) throw new Error("No saved card for this trip.");

    const car = trip.vehicle ? `${trip.vehicle.year} ${trip.vehicle.make} ${trip.vehicle.model}` : "car";
    const pi = await stripe.paymentIntents.create(
      {
        amount: trip.deposit_cents,
        currency: "usd",
        customer,
        payment_method: trip.stripe_payment_method_id,
        payment_method_types: ["card"],
        capture_method: "manual",
        off_session: true,
        confirm: true,
        description: `Security deposit, ${car}`,
        metadata: { trip_id: trip.id, kind: "deposit" },
      },
      { idempotencyKey: `deposit-${trip.id}` }
    );
    if (pi.status !== "requires_capture") {
      await admin.from("trips").update({ deposit_status: "failed", deposit_payment_intent_id: pi.id }).eq("id", trip.id);
      return;
    }
    await admin
      .from("trips")
      .update({ deposit_status: "held", deposit_payment_intent_id: pi.id })
      .eq("id", trip.id)
      .eq("deposit_status", "none");
    await notifyTrip(trip.id, "deposit_held", { amountCents: trip.deposit_cents });
  } catch (err) {
    console.error("[charges] deposit hold failed", tripId, err);
    await admin
      .from("trips")
      .update({ deposit_status: "failed", deposit_payment_intent_id: failedIntentId(err) })
      .eq("id", tripId)
      .eq("deposit_status", "none");
  }
}

/** Lets go of a held deposit. Never throws; returns whether it's released. */
async function releaseDeposit(trip: { id: string; deposit_cents: number; deposit_payment_intent_id: string | null }) {
  const admin = createAdminClient();
  try {
    if (trip.deposit_payment_intent_id) {
      try {
        await stripe.paymentIntents.cancel(trip.deposit_payment_intent_id);
      } catch (err) {
        // Already cancelled (an expired hold is): nothing left to release.
        if ((err as Stripe.errors.StripeError).code !== "payment_intent_unexpected_state") throw err;
        const pi = await stripe.paymentIntents.retrieve(trip.deposit_payment_intent_id);
        if (pi.status !== "canceled") throw err;
      }
    }
    const { data } = await admin
      .from("trips")
      .update({ deposit_status: "released" })
      .eq("id", trip.id)
      .eq("deposit_status", "held")
      .select("id");
    if (data?.length) await notifyTrip(trip.id, "deposit_released", { amountCents: trip.deposit_cents });
    return true;
  } catch (err) {
    console.error("[charges] deposit release failed", trip.id, err);
    return false;
  }
}

/** Sends the host 100% of a paid charge. Never throws; safe to retry. */
async function payoutCharge(
  charge: Pick<TripCharge, "id" | "trip_id" | "host_id" | "amount_cents" | "stripe_payment_intent_id">,
  sourceCharge?: string | null
) {
  const admin = createAdminClient();
  try {
    const { data: host } = await admin.from("profiles").select("stripe_account_id").eq("id", charge.host_id).single();
    if (!host?.stripe_account_id) return; // no bank yet: the cron tries again later

    let source = sourceCharge ?? null;
    if (!source && charge.stripe_payment_intent_id) {
      source = latestCharge(await stripe.paymentIntents.retrieve(charge.stripe_payment_intent_id));
    }
    await stripe.transfers.create(
      {
        amount: charge.amount_cents,
        currency: "usd",
        destination: host.stripe_account_id,
        transfer_group: charge.trip_id,
        metadata: { trip_id: charge.trip_id, charge_id: charge.id },
        ...(source ? { source_transaction: source } : {}),
      },
      { idempotencyKey: `charge-payout-${charge.id}` }
    );
    await admin.from("trip_charges").update({ paid_out_at: new Date().toISOString() }).eq("id", charge.id);
  } catch (err) {
    console.error("[charges] payout failed", charge.id, err);
  }
}

/**
 * Takes a charge from the deposit hold when it covers it, otherwise from the
 * card on file. A deposit can be captured once, so the first charge it covers
 * takes it and the rest of the hold is released.
 */
async function collect(
  charge: TripCharge,
  trip: NonNullable<Awaited<ReturnType<typeof loadPayer>>>
): Promise<{ pi: Stripe.PaymentIntent; fromDeposit: boolean }> {
  const admin = createAdminClient();

  if (trip.deposit_status === "held" && trip.deposit_payment_intent_id && charge.amount_cents <= trip.deposit_cents) {
    // Claim the deposit first, so two charges can't both try to capture it.
    const { data: claimed } = await admin
      .from("trips")
      .update({ deposit_status: "captured" })
      .eq("id", trip.id)
      .eq("deposit_status", "held")
      .select("id");
    if (claimed?.length) {
      try {
        const pi = await stripe.paymentIntents.capture(
          trip.deposit_payment_intent_id,
          { amount_to_capture: charge.amount_cents },
          { idempotencyKey: `deposit-capture-${charge.id}` }
        );
        if (pi.status === "succeeded") return { pi, fromDeposit: true };
      } catch (err) {
        console.error("[charges] deposit capture failed", charge.id, err);
      }
      // The hold may have lapsed. If it's gone, say so; otherwise put it back.
      const pi = await stripe.paymentIntents.retrieve(trip.deposit_payment_intent_id).catch(() => null);
      await admin
        .from("trips")
        .update({ deposit_status: pi?.status === "canceled" ? "released" : "held" })
        .eq("id", trip.id);
    }
  }

  const customer = trip.guest?.stripe_customer_id;
  if (!customer || !trip.stripe_payment_method_id) throw new Error("There's no saved card for this trip.");
  const car = trip.vehicle ? `${trip.vehicle.make} ${trip.vehicle.model}` : "car";
  const pi = await stripe.paymentIntents.create(
    {
      amount: charge.amount_cents,
      currency: "usd",
      customer,
      payment_method: trip.stripe_payment_method_id,
      payment_method_types: ["card"],
      off_session: true,
      confirm: true,
      description: `Trip charge: ${charge.description.slice(0, 200)} (${car})`,
      metadata: { trip_id: trip.id, charge_id: charge.id, kind: charge.kind },
    },
    // A new key per attempt (a failed try moves responded_at), the same key for a double tap.
    { idempotencyKey: `charge-${charge.id}-${charge.responded_at ?? charge.created_at}` }
  );
  if (pi.status !== "succeeded") {
    throw Object.assign(new Error("The bank wants the guest to confirm this payment, so it couldn't go through automatically."), {
      payment_intent: pi,
    });
  }
  return { pi, fromDeposit: false };
}

/**
 * Collects one charge from the guest: from the deposit when one is held,
 * otherwise off-session on the saved card. Marks it paid or failed, tells both
 * sides, and pays the host. Never throws.
 */
export async function chargeGuest(charge: TripCharge | string): Promise<ChargeResult> {
  const admin = createAdminClient();
  const id = typeof charge === "string" ? charge : charge.id;
  const { data: row } = await admin.from("trip_charges").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "This charge doesn't exist." };
  if (!["requested", "disputed", "failed"].includes(row.status)) {
    return { ok: false, error: "This charge is already settled." };
  }

  const trip = await loadPayer(row.trip_id);
  if (!trip) return { ok: false, error: "This trip doesn't exist." };
  const now = new Date().toISOString();

  try {
    const { pi, fromDeposit } = await collect(row, trip);
    const { data: paid } = await admin
      .from("trip_charges")
      .update({
        status: "paid",
        stripe_payment_intent_id: pi.id,
        paid_from_deposit: fromDeposit,
        failure_reason: null,
        responded_at: row.responded_at ?? now,
      })
      .eq("id", row.id)
      .in("status", ["requested", "disputed", "failed"])
      .select("*")
      .maybeSingle();
    if (paid) {
      await notifyTrip(row.trip_id, "charge_paid", { amountCents: row.amount_cents, key: row.id });
      await payoutCharge(paid, latestCharge(pi));
    }
    return { ok: true, fromDeposit };
  } catch (err) {
    const reason = failureReason(err);
    console.error("[charges] charge failed", row.id, err);
    const intent = failedIntentId(err) ?? (err as { payment_intent?: { id: string } }).payment_intent?.id ?? null;
    await admin
      .from("trip_charges")
      .update({
        status: "failed",
        failure_reason: reason.slice(0, 500),
        responded_at: now,
        ...(intent ? { stripe_payment_intent_id: intent } : {}),
      })
      .eq("id", row.id);
    await notifyTrip(row.trip_id, "charge_failed", { amountCents: row.amount_cents, key: row.id });
    return { ok: false, error: reason };
  }
}

/**
 * An admin's call on a disputed charge: "charge" collects it as sent,
 * "decline" drops it. Tells both sides. Never throws.
 */
export async function resolveCharge(
  chargeId: string,
  decision: "charge" | "decline",
  note: string
): Promise<ChargeResult> {
  const admin = createAdminClient();
  const { data: charge } = await admin.from("trip_charges").select("*").eq("id", chargeId).maybeSingle();
  if (!charge) return { ok: false, error: "This charge doesn't exist." };
  if (!["requested", "disputed", "failed"].includes(charge.status)) {
    return { ok: false, error: "This charge is already settled." };
  }

  const now = new Date().toISOString();
  const resolution = note.trim().slice(0, 2000) || null;
  const amount = formatCurrency(charge.amount_cents);
  const tell = (userId: string, title: string, body: string, href: string) =>
    notify({ userId, kind: "charge_resolved", title, body, href, tripId: charge.trip_id, dedupeKey: `charge_resolved:${charge.id}:${userId}` });

  if (decision === "decline") {
    const { error } = await admin
      .from("trip_charges")
      .update({ status: "declined", resolution_note: resolution, resolved_at: now })
      .eq("id", charge.id)
      .in("status", ["requested", "disputed", "failed"]);
    if (error) return { ok: false, error: "Couldn't save the decision. Try again." };
    await Promise.all([
      tell(charge.guest_id, `The ${amount} charge was dropped`, `Cascade looked at it and you won't be charged.${resolution ? `\n${resolution}` : ""}`, `/trips/${charge.trip_id}`),
      tell(charge.host_id, `Cascade declined your ${amount} charge`, `The guest won't be charged.${resolution ? `\n${resolution}` : ""}`, `/host/trips/${charge.trip_id}`),
    ]);
    return { ok: true, fromDeposit: false };
  }

  await admin.from("trip_charges").update({ resolution_note: resolution, resolved_at: now }).eq("id", charge.id);
  await Promise.all([
    tell(charge.guest_id, `The ${amount} charge stands`, `Cascade looked at the photos and both sides, and the charge goes ahead.${resolution ? `\n${resolution}` : ""}`, `/trips/${charge.trip_id}`),
    tell(charge.host_id, `Cascade approved your ${amount} charge`, `We're collecting it from the guest now.${resolution ? `\n${resolution}` : ""}`, `/host/trips/${charge.trip_id}`),
  ]);
  return chargeGuest(charge.id);
}

/** Cron: charges guests who left a charge unanswered, releases deposits that are due. */
export async function processDueCharges(): Promise<void> {
  const admin = createAdminClient();
  const now = Date.now();

  // Charges nobody answered in 3 days are collected as sent.
  const { data: due } = await admin
    .from("trip_charges")
    .select("id")
    .eq("status", "requested")
    .lt("created_at", new Date(now - AUTO_CHARGE_DAYS * DAY_MS).toISOString())
    .limit(100);
  for (const charge of due ?? []) await chargeGuest(charge.id);

  // Deposits go back 48 hours after the trip, or straight away if it was
  // cancelled, unless a charge is still open.
  const releaseBefore = new Date(now - DEPOSIT_RELEASE_HOURS * 3_600_000).toISOString();
  const { data: held } = await admin
    .from("trips")
    .select("id, deposit_cents, deposit_payment_intent_id, trip_charges(status)")
    .eq("deposit_status", "held")
    .or(`ends_at.lt.${releaseBefore},status.in.(cancelled_guest,cancelled_host)`)
    .limit(100);
  for (const trip of held ?? []) {
    const open = (trip.trip_charges as { status: string }[] | null)?.some(
      (c) => c.status === "requested" || c.status === "disputed"
    );
    if (!open) await releaseDeposit(trip);
  }

  // Paid charges whose host had no bank connected yet.
  const { data: unpaid } = await admin
    .from("trip_charges")
    .select("id, trip_id, host_id, amount_cents, stripe_payment_intent_id")
    .eq("status", "paid")
    .is("paid_out_at", null)
    .limit(50);
  for (const charge of unpaid ?? []) await payoutCharge(charge);
}
