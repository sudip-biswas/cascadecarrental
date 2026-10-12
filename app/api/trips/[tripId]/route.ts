import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/server";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const { action } = parsed.data;

  // Fetch trip — user must be the host
  const { data: trip } = await supabase
    .from("trips")
    .select("id, status, host_id, stripe_payment_intent_id")
    .eq("id", tripId)
    .single();

  if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (trip.host_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (trip.status !== "pending") {
    return NextResponse.json({ error: "Only pending trips can be approved or rejected" }, { status: 400 });
  }

  if (action === "approve") {
    // Capture the Stripe payment hold
    if (trip.stripe_payment_intent_id) {
      try {
        const stripe = getStripe();
        await stripe.paymentIntents.capture(trip.stripe_payment_intent_id);
      } catch {
        // Capture may fail if card declined — still update status
      }
    }

    await supabase
      .from("trips")
      .update({ status: "approved", payment_status: "captured" })
      .eq("id", tripId);
  } else {
    // Reject = cancel by host
    if (trip.stripe_payment_intent_id) {
      try {
        const stripe = getStripe();
        await stripe.paymentIntents.cancel(trip.stripe_payment_intent_id);
      } catch {
        // Already cancelled
      }
    }

    await supabase
      .from("trips")
      .update({
        status: "cancelled_host",
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", tripId);
  }

  return NextResponse.json({ success: true });
}
