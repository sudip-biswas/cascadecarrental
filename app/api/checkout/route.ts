import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { computePricing, tripDays } from "@/lib/pricing";
import { hasConflict, releaseStaleCheckouts } from "@/lib/trips";
import { pluralize, zonedInstant } from "@/lib/utils";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schema = z.object({
  vehicleId: z.string().uuid(),
  from: dateKey,
  until: dateKey,
  rateType: z.enum(["refundable", "non_refundable"]),
  protectionPlan: z.enum(["basic", "standard", "premium"]).nullable(),
  /** The total the guest saw. If the price moved since, they get to see the new one first. */
  expectedTotalCents: z.number().int().positive(),
  /** Decides charge-now vs hold on the card form, so it has to match too. */
  expectedInstantBook: z.boolean(),
});

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Log in to book.", 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Something's off with this booking. Refresh and try again.", 400);
  const { vehicleId, from, until, rateType, protectionPlan, expectedTotalCents, expectedInstantBook } =
    parsed.data;

  const startsAt = zonedInstant(from);
  const endsAt = zonedInstant(until);
  if (endsAt <= startsAt) return fail("The return date has to be after pick-up.", 400);

  const admin = createAdminClient();
  const { data: vehicle } = await admin
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .eq("status", "listed")
    .single();
  if (!vehicle) return fail("This car isn't available any more.", 404);
  if (vehicle.host_id === user.id) return fail("You can't book your own car.", 400);

  const days = tripDays(startsAt, endsAt);
  if (days < vehicle.min_trip_days) {
    return fail(`This car needs at least ${pluralize(vehicle.min_trip_days, "day")}.`, 400);
  }
  if (vehicle.max_trip_days && days > vehicle.max_trip_days) {
    return fail(`This car can be booked for up to ${pluralize(vehicle.max_trip_days, "day")}.`, 400);
  }
  const noticeMs = vehicle.advance_notice_hours * 60 * 60 * 1000;
  if (startsAt.getTime() - Date.now() < noticeMs) {
    return fail(
      vehicle.advance_notice_hours > 0
        ? `The host needs ${pluralize(vehicle.advance_notice_hours, "hour")} notice. Pick a later date.`
        : "Pick-up has to be in the future.",
      400
    );
  }

  await releaseStaleCheckouts(vehicleId, user.id);
  if (await hasConflict(vehicleId, startsAt, endsAt)) {
    return fail("Someone just booked these dates. Try others.", 409);
  }

  const pricing = computePricing({
    dailyRateCents: vehicle.daily_rate_cents,
    days,
    protectionPlan,
    rateType,
    weeklyDiscountPct: vehicle.weekly_discount_pct,
    monthlyDiscountPct: vehicle.monthly_discount_pct,
  });
  if (pricing.totalCents !== expectedTotalCents) {
    return fail("The price changed. Check the new total and try again.", 409);
  }
  if (vehicle.instant_book !== expectedInstantBook) {
    return fail("The host just changed how this car is booked. Check the page again.", 409);
  }

  const { data: profile } = await admin
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
    await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  // Instant-book cars are charged straight away. Otherwise the card is only
  // held until the host accepts.
  const paymentIntent = await stripe.paymentIntents.create({
    amount: pricing.totalCents,
    currency: "usd",
    customer: customerId,
    // Cards (and wallets) only: they settle instantly and support holds.
    payment_method_types: ["card"],
    capture_method: vehicle.instant_book ? "automatic" : "manual",
    description: `${vehicle.year} ${vehicle.make} ${vehicle.model}, ${from} to ${until}`,
    metadata: {
      vehicle_id: vehicleId,
      guest_id: user.id,
      host_id: vehicle.host_id,
      from,
      until,
    },
  });

  const { data: trip, error } = await admin
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
      pay_later: false,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !trip) {
    await stripe.paymentIntents.cancel(paymentIntent.id);
    // 23P01: the overlap constraint caught a booking that landed in between.
    return error?.code === "23P01"
      ? fail("Someone just booked these dates. Try others.", 409)
      : fail("Couldn't start the booking. Try again.", 500);
  }

  return NextResponse.json({ clientSecret: paymentIntent.client_secret, tripId: trip.id });
}
