import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CANCEL_REASON } from "@/lib/trip-status";
import { applyPaymentIntent } from "@/lib/trips";

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.succeeded":
    case "payment_intent.amount_capturable_updated":
    case "payment_intent.payment_failed":
    case "payment_intent.canceled":
      await applyPaymentIntent(event.data.object);
      break;

    case "charge.refunded": {
      // Full refunds made from the Stripe dashboard.
      const charge = event.data.object;
      const paymentIntentId =
        typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
      if (charge.refunded && paymentIntentId) {
        const admin = createAdminClient();
        const now = new Date().toISOString();
        await admin
          .from("trips")
          .update({ payment_status: "refunded", updated_at: now })
          .eq("stripe_payment_intent_id", paymentIntentId);
        // A trip that hasn't started is off once its money is back.
        await admin
          .from("trips")
          .update({ status: "cancelled_host", cancellation_reason: CANCEL_REASON.refunded, cancelled_at: now })
          .eq("stripe_payment_intent_id", paymentIntentId)
          .in("status", ["pending", "approved"]);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
