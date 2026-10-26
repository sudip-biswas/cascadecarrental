import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { CANCEL_REASON } from "@/lib/trip-status";
import { applyPaymentIntent, capturePayment, settleCancellation } from "@/lib/trips";
import { notifyTripLater } from "@/lib/notify";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
});

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** The host accepts or declines a booking request. */
export async function PATCH(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Unauthorized", 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Invalid action", 400);
  const { action } = parsed.data;

  const admin = createAdminClient();
  const { data: trip } = await admin
    .from("trips")
    .select("id, status, host_id, payment_status, stripe_payment_intent_id")
    .eq("id", tripId)
    .single();

  if (!trip) return fail("Trip not found", 404);
  if (trip.host_id !== user.id) return fail("Forbidden", 403);
  if (trip.status !== "pending") return fail("This request has already been answered.", 409);

  const now = new Date().toISOString();

  if (action === "reject") {
    const paymentStatus = await settleCancellation(trip, 0);
    await admin
      .from("trips")
      .update({
        status: "cancelled_host",
        payment_status: paymentStatus,
        cancellation_reason: CANCEL_REASON.declined,
        cancelled_at: now,
        updated_at: now,
      })
      .eq("id", tripId);
    notifyTripLater(tripId, "declined");
    return NextResponse.json({ status: "cancelled_host" });
  }

  if (trip.payment_status !== "authorized") {
    return fail("The guest hasn't finished paying yet.", 409);
  }

  let pi: Stripe.PaymentIntent;
  try {
    pi = await capturePayment(trip);
  } catch {
    // A double tap finds it already charged; a lapsed hold finds it cancelled.
    // Anything else is worth a retry.
    pi = await stripe.paymentIntents.retrieve(trip.stripe_payment_intent_id!);
    if (pi.status !== "succeeded" && pi.status !== "canceled") {
      return fail("Couldn't charge the guest's card. Try again in a minute.", 502);
    }
  }

  // Tells the guest the host said yes.
  const updated = await applyPaymentIntent(pi);
  if (updated?.status !== "approved") {
    return fail(
      pi.status === "canceled"
        ? "The card hold has expired, so the request was closed."
        : "This request was cancelled before you accepted it.",
      409
    );
  }
  return NextResponse.json({ status: "approved" });
}
