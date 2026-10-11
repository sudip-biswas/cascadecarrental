import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe/server";
import { computePricing } from "@/lib/pricing";
import { differenceInDays } from "date-fns";

const schema = z.object({
  vehicleId: z.string().uuid(),
  from: z.string().datetime({ offset: true }).or(z.string().date()),
  until: z.string().datetime({ offset: true }).or(z.string().date()),
  rateType: z.enum(["refundable", "non_refundable"]).default("non_refundable"),
  protectionPlan: z.enum(["basic", "standard", "premium"]).nullable().default(null),
  payLater: z.boolean().default(false),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const { vehicleId, from, until, rateType, protectionPlan, payLater } =
    parsed.data;

  const startsAt = new Date(from);
  const endsAt = new Date(until);
  const days = Math.max(1, differenceInDays(endsAt, startsAt));

  // Fetch vehicle
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .eq("status", "listed")
    .single();

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  // Check availability — no overlapping active trips
  const { data: conflictingTrips } = await supabase
    .from("trips")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .not("status", "in", '("cancelled_guest","cancelled_host")')
    .or(`and(starts_at.lte.${until},ends_at.gte.${from})`);

  if (conflictingTrips && conflictingTrips.length > 0) {
    return NextResponse.json(
      { error: "Vehicle is not available for the selected dates" },
      { status: 409 }
    );
  }

  // Check host-blocked dates
  const { data: blockedDates } = await supabase
    .from("vehicle_availability")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .or(`and(blocked_from.lte.${until},blocked_to.gte.${from})`);

  if (blockedDates && blockedDates.length > 0) {
    return NextResponse.json(
      { error: "Vehicle is blocked for the selected dates" },
      { status: 409 }
    );
  }

  // Compute pricing
  const pricing = computePricing({
    dailyRateCents: vehicle.daily_rate_cents,
    days,
    protectionPlan,
    rateType,
  });

  // Get or create Stripe customer
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  // Create Stripe PaymentIntent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: pricing.totalCents,
    currency: "usd",
    customer: customerId,
    capture_method: payLater && rateType === "refundable" ? "manual" : "automatic",
    metadata: {
      vehicle_id: vehicleId,
      guest_id: user.id,
      host_id: vehicle.host_id,
      from,
      until,
    },
  });

  // Insert trip row
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .insert({
      vehicle_id: vehicleId,
      guest_id: user.id,
      host_id: vehicle.host_id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      pickup_location: vehicle.location_name,
      daily_rate_cents: vehicle.daily_rate_cents,
      subtotal_cents: pricing.subtotalCents,
      tax_cents: pricing.taxCents,
      total_cents: pricing.totalCents,
      distance_included_mi: vehicle.distance_included_mi,
      extra_mile_fee_cents: vehicle.extra_mile_fee_cents,
      rate_type: rateType,
      protection_plan: protectionPlan,
      protection_cost_cents: pricing.protectionCostCents,
      stripe_payment_intent_id: paymentIntent.id,
      payment_status: "pending",
      pay_later: payLater,
      status: "pending",
    })
    .select()
    .single();

  if (tripError) {
    // Cancel the PaymentIntent if trip insert fails
    await stripe.paymentIntents.cancel(paymentIntent.id);
    return NextResponse.json({ error: "Failed to create trip" }, { status: 500 });
  }

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    tripId: trip.id,
    pricing,
  });
}
