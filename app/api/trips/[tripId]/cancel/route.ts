import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch trip — user must be guest or host
  const { data: trip, error: fetchError } = await supabase
    .from("trips")
    .select("id, status, guest_id, host_id, stripe_payment_intent_id, rate_type")
    .eq("id", tripId)
    .single();

  if (fetchError || !trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  const isGuest = trip.guest_id === user.id;
  const isHost = trip.host_id === user.id;

  if (!isGuest && !isHost) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["pending", "approved"].includes(trip.status)) {
    return NextResponse.json(
      { error: "Trip cannot be cancelled in its current state" },
      { status: 400 }
    );
  }

  const newStatus = isGuest ? "cancelled_guest" : "cancelled_host";

  // Cancel Stripe PaymentIntent (release auth hold) if it exists
  if (trip.stripe_payment_intent_id) {
    try {
      const stripe = getStripe();
      await stripe.paymentIntents.cancel(trip.stripe_payment_intent_id);
    } catch {
      // Payment may already be cancelled — proceed with DB update
    }
  }

  const { error: updateError } = await supabase
    .from("trips")
    .update({
      status: newStatus,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", tripId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to cancel trip" }, { status: 500 });
  }

  return NextResponse.json({ status: newStatus });
}
