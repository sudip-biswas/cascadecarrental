import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { applyPaymentIntent } from "@/lib/trips";

/**
 * Called by checkout right after the card step, so the trip shows the right
 * state without waiting for Stripe's webhook.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: trip } = await createAdminClient()
    .from("trips")
    .select("guest_id, status, payment_status, stripe_payment_intent_id")
    .eq("id", tripId)
    .single();
  if (!trip || trip.guest_id !== user.id) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }
  if (!trip.stripe_payment_intent_id) {
    return NextResponse.json({ status: trip.status, paymentStatus: trip.payment_status });
  }

  const pi = await stripe.paymentIntents.retrieve(trip.stripe_payment_intent_id);
  const updated = await applyPaymentIntent(pi);
  return NextResponse.json({
    status: updated?.status ?? trip.status,
    paymentStatus: updated?.payment_status ?? trip.payment_status,
  });
}
