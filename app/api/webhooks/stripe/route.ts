import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe/server";
import { createServiceClient } from "@/lib/supabase/server";
import type Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await supabase
        .from("trips")
        .update({
          payment_status: "captured",
          status: "approved",
          stripe_charge_id: pi.latest_charge as string,
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_payment_intent_id", pi.id);
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await supabase
        .from("trips")
        .update({
          payment_status: "failed",
          status: "cancelled_guest",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_payment_intent_id", pi.id);
      break;
    }

    case "payment_intent.canceled": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await supabase
        .from("trips")
        .update({
          payment_status: "failed",
          status: "cancelled_guest",
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_payment_intent_id", pi.id);
      break;
    }

    default:
      // Unhandled event type
      break;
  }

  return NextResponse.json({ received: true });
}
