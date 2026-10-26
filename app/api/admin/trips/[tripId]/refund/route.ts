import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { notify } from "@/lib/notify";
import { formatCurrency } from "@/lib/utils";
import { fail, refundableCents, requireAdminApi } from "@/app/(host)/host/admin/_lib/admin";

const schema = z.object({
  amountCents: z.number().int().positive(),
  /** Made fresh each time the dialog opens: a double click or retry refunds once, a second refund gets a new id. */
  requestId: z.string().uuid(),
  note: z.string().trim().max(500).default(""),
});

/** A manual refund to the guest, full or partial, without touching the trip itself. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/trips/[tripId]/refund">) {
  const { user, denied } = await requireAdminApi();
  if (denied) return denied;
  const { tripId } = await ctx.params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Enter an amount in whole cents.", 400);
  const { amountCents, requestId, note } = parsed.data;

  const admin = createAdminClient();
  const { data: trip } = await admin
    .from("trips")
    .select("id, guest_id, payment_status, stripe_payment_intent_id")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return fail("Trip not found.", 404);
  if (!trip.stripe_payment_intent_id || (trip.payment_status !== "captured" && trip.payment_status !== "refunded")) {
    return fail("Nothing was charged on this trip, so there's nothing to refund.", 409);
  }

  let left: number;
  try {
    left = (await refundableCents(trip.stripe_payment_intent_id)).leftCents;
  } catch {
    return fail("Couldn't reach Stripe. Nothing was refunded, try again.", 502);
  }
  if (amountCents > left) return fail(`Only ${formatCurrency(left)} is left to refund.`, 409);

  try {
    await stripe.refunds.create(
      {
        payment_intent: trip.stripe_payment_intent_id,
        amount: amountCents,
        reason: "requested_by_customer",
        metadata: { trip_id: trip.id, refunded_by: user.id, note: note.slice(0, 500) },
      },
      { idempotencyKey: `admin-refund-${trip.id}-${requestId}` }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Stripe refused the refund.";
    return fail(msg, 502);
  }

  const fully = amountCents === left;
  if (fully && trip.payment_status !== "refunded") {
    await admin.from("trips").update({ payment_status: "refunded", updated_at: new Date().toISOString() }).eq("id", trip.id);
  }

  await notify({
    userId: trip.guest_id,
    kind: "refund",
    title: `${formatCurrency(amountCents)} is on its way back`,
    body: `${fully ? "Cascade refunded what's left of your trip." : "Cascade refunded part of your trip."}${note ? `\n${note}` : ""}\nBanks can take 5 to 10 days to show it.`,
    href: `/trips/${trip.id}`,
    tripId: trip.id,
    dedupeKey: `refund:${trip.id}:${requestId}`,
    actionLabel: "See your trip",
  });

  return NextResponse.json({ refundedCents: amountCents, leftCents: left - amountCents });
}
