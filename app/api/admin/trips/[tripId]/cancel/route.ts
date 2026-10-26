import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyTrip } from "@/lib/notify";
import { CANCEL_REASON } from "@/lib/trip-status";
import { isCancelled, settleCancellation } from "@/lib/trips";
import { formatCurrency } from "@/lib/utils";
import { fail, refundableCents, requireAdminApi } from "@/app/(host)/host/admin/_lib/admin";

const schema = z.object({
  /** What goes back to the guest if the card was charged. A held card is always released. */
  refundCents: z.number().int().min(0),
  /** "refunded": Cascade stepped in. "byHost": the host couldn't do it, on the record as theirs. */
  reason: z.enum(["refunded", "byHost"]),
});

/** Cancels a trip on Cascade's behalf: releases the hold or refunds, then frees the dates. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/trips/[tripId]/cancel">) {
  const { denied } = await requireAdminApi();
  if (denied) return denied;
  const { tripId } = await ctx.params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Pick a reason and a refund amount.", 400);
  const { reason } = parsed.data;

  const admin = createAdminClient();
  const { data: trip } = await admin.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (!trip) return fail("Trip not found.", 404);
  if (isCancelled(trip.status) || trip.status === "completed") return fail("This trip is already over.", 409);

  // Never refund more than is still on the payment, say after a manual refund.
  let refundCents = 0;
  let fullRefund = true;
  if (trip.payment_status === "captured" && trip.stripe_payment_intent_id) {
    let left: number;
    try {
      left = (await refundableCents(trip.stripe_payment_intent_id)).leftCents;
    } catch {
      return fail("Couldn't reach Stripe. Nothing was changed, try again.", 502);
    }
    if (parsed.data.refundCents > left) return fail(`Only ${formatCurrency(left)} is left to refund.`, 409);
    refundCents = parsed.data.refundCents;
    fullRefund = refundCents === left;
  }

  let paymentStatus;
  try {
    paymentStatus = await settleCancellation(trip, refundCents);
  } catch {
    return fail("Couldn't reach the payment provider. Nothing was changed, try again.", 502);
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("trips")
    .update({
      status: "cancelled_host",
      payment_status: paymentStatus,
      cancellation_reason: CANCEL_REASON[reason],
      cancelled_at: now,
      updated_at: now,
    })
    .eq("id", trip.id);
  if (error) return fail("The money moved but the trip didn't save. Try again.", 500);

  if (fullRefund) {
    await notifyTrip(trip.id, reason === "refunded" ? "cancelled_by_cascade" : "cancelled_by_host");
  } else {
    // The stock messages promise everything back, which isn't true here.
    const body = refundCents > 0 ? `${formatCurrency(refundCents)} is on its way back to your card.` : "There's no refund on this one.";
    await Promise.all([
      notify({ userId: trip.guest_id, kind: "cancelled_by_cascade", title: "Your trip is cancelled", body: `Cascade cancelled it.\n${body}`, href: `/trips/${trip.id}`, tripId: trip.id, dedupeKey: `cancelled_by_cascade:${trip.id}:guest` }),
      notify({ userId: trip.host_id, kind: "cancelled_by_cascade", title: "A trip is cancelled", body: "Cascade cancelled it. Those dates are open again.", href: `/host/trips/${trip.id}`, tripId: trip.id, dedupeKey: `cancelled_by_cascade:${trip.id}:host` }),
    ]);
  }

  return NextResponse.json({ status: "cancelled_host", refundCents: paymentStatus === "refunded" ? refundCents : 0 });
}
