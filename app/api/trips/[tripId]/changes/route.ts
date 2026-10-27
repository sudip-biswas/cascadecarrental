import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { notify, notifyTripLater } from "@/lib/notify";
import { syncTripMessagesLater } from "@/lib/scheduled-messages";
import type { Database, Trip, TripChange } from "@/lib/supabase/types";
import { CHANGEABLE_STATUSES, type ChangePricing, describeChange, hasOtherConflict, loadQuoteTrip, quoteChange } from "@/lib/trip-changes";
import { formatCurrency, zonedInstant } from "@/lib/utils";

type TripUpdate = Database["public"]["Tables"]["trips"]["Update"];

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^\d{2}:\d{2}$/);

const dates = z.object({ from: dateKey, until: dateKey, fromTime: time, untilTime: time });

const answer = z.object({
  changeId: z.string().uuid(),
  action: z.enum(["accept", "decline", "cancel"]),
});

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function caller() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function quoteJson(quote: Extract<Awaited<ReturnType<typeof quoteChange>>, { ok: true }>) {
  return {
    startsAt: quote.startsAt.toISOString(),
    endsAt: quote.endsAt.toISOString(),
    pricing: quote.pricing,
    differenceCents: quote.differenceCents,
    summary: quote.summary,
  };
}

/** A live quote for new dates, for the guest's change form. */
export async function GET(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await caller();
  if (!user) return fail("Log in to change a trip.", 401);

  const url = new URL(req.url);
  const parsed = dates.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return fail("Pick a pick-up and return.", 400);
  const { from, until, fromTime, untilTime } = parsed.data;

  const trip = await loadQuoteTrip(tripId);
  if (!trip) return fail("Trip not found", 404);
  if (trip.guest_id !== user.id) return fail("Forbidden", 403);

  const quote = await quoteChange(trip, zonedInstant(from, fromTime), zonedInstant(until, untilTime));
  if (!quote.ok) return fail(quote.reason, quote.status);
  return NextResponse.json(quoteJson(quote));
}

/** The guest asks the host for new dates. */
export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await caller();
  if (!user) return fail("Log in to change a trip.", 401);

  const parsed = dates.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Pick a pick-up and return.", 400);
  const { from, until, fromTime, untilTime } = parsed.data;

  const trip = await loadQuoteTrip(tripId);
  if (!trip) return fail("Trip not found", 404);
  if (trip.guest_id !== user.id) return fail("Only the guest can ask to change a trip.", 403);

  const admin = createAdminClient();
  const quote = await quoteChange(trip, zonedInstant(from, fromTime), zonedInstant(until, untilTime));
  if (!quote.ok) return fail(quote.reason, quote.status);

  const row = {
    trip_id: tripId,
    requested_by: user.id,
    old_starts_at: trip.starts_at,
    old_ends_at: trip.ends_at,
    new_starts_at: quote.startsAt.toISOString(),
    new_ends_at: quote.endsAt.toISOString(),
    pricing: quote.pricing as unknown as Database["public"]["Tables"]["trip_changes"]["Insert"]["pricing"],
    difference_cents: quote.differenceCents,
  };
  const note = describeChange(row);
  const { data: change, error } = await admin
    .from("trip_changes")
    .insert({ ...row, note })
    .select("id")
    .single();
  if (error || !change) {
    // 23505: trip_changes_one_open, a request is already waiting.
    return error?.code === "23505"
      ? fail("You already have a change waiting on the host.", 409)
      : fail("Couldn't send the change. Try again.", 500);
  }

  notifyTripLater(tripId, "change_requested", { note, key: change.id });
  return NextResponse.json({ changeId: change.id, ...quoteJson(quote) });
}

type ChangeTrip = Pick<
  Trip,
  | "id"
  | "vehicle_id"
  | "guest_id"
  | "host_id"
  | "status"
  | "payment_status"
  | "starts_at"
  | "ends_at"
  | "stripe_payment_intent_id"
  | "stripe_payment_method_id"
  | "total_cents"
  | "subtotal_cents"
  | "rental_cents"
  | "tax_cents"
  | "base_cents"
  | "daily_rate_cents"
  | "extras"
  | "extras_cents"
  | "protection_cost_cents"
  | "young_driver_cents"
  | "promo_cents"
  | "pickup_reminded_at"
  | "return_reminded_at"
>;

const TRIP_FIELDS =
  "id, vehicle_id, guest_id, host_id, status, payment_status, starts_at, ends_at, stripe_payment_intent_id, stripe_payment_method_id, total_cents, subtotal_cents, rental_cents, tax_cents, base_cents, daily_rate_cents, extras, extras_cents, protection_cost_cents, young_driver_cents, promo_cents, pickup_reminded_at, return_reminded_at";

/** The trip's dates and money as they stand, to put back if the money doesn't move. */
function snapshot(t: ChangeTrip): TripUpdate {
  return {
    starts_at: t.starts_at,
    ends_at: t.ends_at,
    total_cents: t.total_cents,
    subtotal_cents: t.subtotal_cents,
    rental_cents: t.rental_cents,
    tax_cents: t.tax_cents,
    base_cents: t.base_cents,
    daily_rate_cents: t.daily_rate_cents,
    extras: t.extras,
    extras_cents: t.extras_cents,
    protection_cost_cents: t.protection_cost_cents,
    young_driver_cents: t.young_driver_cents,
    promo_cents: t.promo_cents,
    pickup_reminded_at: t.pickup_reminded_at,
    return_reminded_at: t.return_reminded_at,
  };
}

function applied(change: TripChange, trip: ChangeTrip): TripUpdate {
  const p = change.pricing as unknown as ChangePricing;
  const startMoved = new Date(change.new_starts_at).getTime() !== new Date(change.old_starts_at).getTime();
  const endMoved = new Date(change.new_ends_at).getTime() !== new Date(change.old_ends_at).getTime();
  return {
    starts_at: change.new_starts_at,
    ends_at: change.new_ends_at,
    // A cheaper trip past free cancellation keeps the price it was paid at.
    ...(p.refunds === false
      ? {}
      : {
          total_cents: p.totalCents,
          subtotal_cents: p.subtotalCents,
          rental_cents: p.rentalCents,
          tax_cents: p.taxCents,
          base_cents: p.baseCents,
          daily_rate_cents: p.dailyRateCents,
          extras: p.extras,
          extras_cents: p.extrasCents,
          protection_cost_cents: p.protectionCostCents,
          young_driver_cents: p.youngDriverCents,
          promo_cents: p.promoCents,
        }),
    // New times get their own reminders.
    pickup_reminded_at: startMoved ? null : trip.pickup_reminded_at,
    return_reminded_at: endMoved ? null : trip.return_reminded_at,
  };
}

async function setTrip(trip: ChangeTrip, update: TripUpdate, guard?: { starts_at: string; ends_at: string }) {
  let query = createAdminClient()
    .from("trips")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", trip.id);
  if (guard) query = query.eq("starts_at", guard.starts_at).eq("ends_at", guard.ends_at).in("status", CHANGEABLE_STATUSES);
  return query.select("id");
}

/** The card the trip was paid with: stored on the trip, or read back from its payment. */
async function paymentMethod(trip: ChangeTrip) {
  if (trip.stripe_payment_method_id) return trip.stripe_payment_method_id;
  if (!trip.stripe_payment_intent_id) return null;
  const pi = await stripe.paymentIntents.retrieve(trip.stripe_payment_intent_id);
  return typeof pi.payment_method === "string" ? pi.payment_method : (pi.payment_method?.id ?? null);
}

type MoneyResult = { ok: true; paymentIntentId?: string; refundId?: string } | { ok: false; message: string };

/** Charges the extra off-session on the trip's card, or refunds the difference on the trip's payment. */
async function moveMoney(change: TripChange, trip: ChangeTrip): Promise<MoneyResult> {
  const cents = change.difference_cents;
  if (cents === 0) return { ok: true };

  if (cents < 0) {
    if (!trip.stripe_payment_intent_id) return { ok: false, message: "This trip has no payment to refund." };
    try {
      const refund = await stripe.refunds.create(
        { payment_intent: trip.stripe_payment_intent_id, amount: -cents, metadata: { trip_id: trip.id, trip_change_id: change.id } },
        { idempotencyKey: `trip-change-refund-${change.id}` }
      );
      return { ok: true, refundId: refund.id };
    } catch {
      return { ok: false, message: "Couldn't refund the difference, so the change didn't go through. The guest can ask again." };
    }
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("stripe_customer_id").eq("id", trip.guest_id).single();
  let pi: Stripe.PaymentIntent;
  try {
    const method = await paymentMethod(trip);
    if (!profile?.stripe_customer_id || !method) {
      return { ok: false, message: "There's no card on file for this guest, so the change didn't go through." };
    }
    pi = await stripe.paymentIntents.create(
      {
        amount: cents,
        currency: "usd",
        customer: profile.stripe_customer_id,
        payment_method: method,
        off_session: true,
        confirm: true,
        description: `Trip change ${trip.id}`,
        metadata: { trip_id: trip.id, trip_change_id: change.id, kind: "trip_change" },
      },
      { idempotencyKey: `trip-change-charge-${change.id}` }
    );
  } catch (err) {
    const declined = (err as Stripe.errors.StripeError).type === "StripeCardError";
    return {
      ok: false,
      message: declined
        ? "The guest's card was declined, so the change didn't go through."
        : "Couldn't charge the guest's card, so the change didn't go through. They can ask again.",
    };
  }
  if (pi.status !== "succeeded") {
    return { ok: false, message: "The guest's card needs them to confirm the payment, so the change didn't go through." };
  }
  return { ok: true, paymentIntentId: pi.id };
}

/** The host accepts or declines a change; the guest can take back their own. */
export async function PATCH(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await caller();
  if (!user) return fail("Unauthorized", 401);

  const parsed = answer.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid action", 400);
  const { changeId, action } = parsed.data;

  const admin = createAdminClient();
  const [{ data: trip }, { data: change }] = await Promise.all([
    admin.from("trips").select(TRIP_FIELDS).eq("id", tripId).maybeSingle(),
    admin.from("trip_changes").select("*").eq("id", changeId).eq("trip_id", tripId).maybeSingle(),
  ]);
  if (!trip || !change) return fail("Change not found", 404);
  const t = trip as unknown as ChangeTrip;

  if (action === "cancel" ? t.guest_id !== user.id : t.host_id !== user.id) return fail("Forbidden", 403);
  if (change.status !== "requested") return fail("This change has already been answered.", 409);

  const now = new Date().toISOString();
  // Moves the request on only from the state we expect, so a double tap or the
  // guest cancelling can't race an accept.
  const settle = async (status: TripChange["status"], from: TripChange["status"] = "requested") => {
    const { data } = await admin
      .from("trip_changes")
      .update({ status, responded_at: now })
      .eq("id", changeId)
      .eq("status", from)
      .select("id");
    return (data?.length ?? 0) > 0;
  };

  if (action === "cancel" || action === "decline") {
    if (!(await settle(action === "cancel" ? "cancelled" : "declined"))) {
      return fail("This change has already been answered.", 409);
    }
    if (action === "decline") notifyTripLater(tripId, "change_declined", { key: changeId });
    return NextResponse.json({ status: action === "cancel" ? "cancelled" : "declined" });
  }

  // Accept. The trip must still be what the guest asked to change.
  if (!CHANGEABLE_STATUSES.includes(t.status) || t.payment_status !== "captured") {
    await settle("declined");
    return fail("This trip can't be changed any more.", 409);
  }
  if (new Date(t.starts_at).getTime() !== new Date(change.old_starts_at).getTime() || new Date(t.ends_at).getTime() !== new Date(change.old_ends_at).getTime()) {
    await settle("declined");
    return fail("The trip's dates changed since this was asked, so it was closed.", 409);
  }
  if (new Date(change.new_ends_at) <= new Date()) {
    await settle("declined");
    return fail("The new return time has already passed, so it was closed.", 409);
  }
  if (await hasOtherConflict(t, new Date(change.new_starts_at), new Date(change.new_ends_at))) {
    return fail("The car got booked for some of those dates, so you can't accept this. Decline it instead.", 409);
  }
  if (!(await settle("accepted"))) return fail("This change has already been answered.", 409);

  // Dates first: the overlap constraint is the last word on double booking.
  const before = snapshot(t);
  const moved = await setTrip(t, applied(change, t), { starts_at: t.starts_at, ends_at: t.ends_at });
  if (moved.error || !moved.data?.length) {
    await settle("failed", "accepted");
    return moved.error?.code === "23P01"
      ? fail("The car got booked for some of those dates, so the change didn't go through.", 409)
      : fail("Couldn't change the trip. Try again.", 500);
  }

  const money = await moveMoney(change, t);
  if (!money.ok) {
    await setTrip(t, before);
    await settle("failed", "accepted");
    if (change.difference_cents > 0) {
      await notify({
        userId: t.guest_id,
        kind: "change_failed",
        title: "Your trip change didn't go through",
        body: `We couldn't charge ${formatCurrency(change.difference_cents)} to your card, so your trip keeps its dates. You can ask again from your trip page.`,
        href: `/trips/${tripId}`,
        tripId,
        dedupeKey: `change_failed:${changeId}`,
        actionLabel: "See your trip",
      });
    }
    return fail(money.message, 402);
  }

  await admin
    .from("trip_changes")
    .update({ stripe_payment_intent_id: money.paymentIntentId ?? null, stripe_refund_id: money.refundId ?? null })
    .eq("id", changeId);

  syncTripMessagesLater(tripId);
  const cents = change.difference_cents;
  notifyTripLater(tripId, "change_accepted", {
    key: changeId,
    ...(cents !== 0
      ? {
          amountCents: Math.abs(cents),
          note: cents > 0 ? `We charged ${formatCurrency(cents)} to your card.` : `${formatCurrency(-cents)} is on its way back to your card.`,
        }
      : {}),
  });
  return NextResponse.json({ status: "accepted", differenceCents: cents });
}
