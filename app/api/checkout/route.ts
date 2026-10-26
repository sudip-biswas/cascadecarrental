import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { computePricing, dayRates, tripDays, type ExtraLine } from "@/lib/pricing";
import { hasConflict, loadDailyPrices, releaseStaleCheckouts } from "@/lib/trips";
import { pluralize, zonedInstant } from "@/lib/utils";
import { driverCheck, quoteDelivery } from "@/components/checkout/rules";
import { checkPromo } from "@/app/api/promo/check";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const delivery = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("pickup") }),
  z.object({
    mode: z.literal("address"),
    address: z.string().trim().min(3).max(300),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  z.object({ mode: z.literal("airport") }),
]);

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
  /** Stripe ConfirmationToken id — when present, we create+confirm the PI in one step. */
  confirmationTokenId: z.string().startsWith("ctoken_").optional(),
  fromTime: z.string().regex(/^\d{2}:\d{2}$/).default("10:00"),
  untilTime: z.string().regex(/^\d{2}:\d{2}$/).default("10:00"),
  /** Extras by id. Names and prices come from the car's own list. */
  extras: z.array(z.object({ id: z.string().uuid(), quantity: z.number().int().min(1).max(10) })).max(20).default([]),
  delivery: delivery.default({ mode: "pickup" }),
  promoCode: z.string().trim().min(1).max(40).optional(),
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
  const {
    vehicleId,
    from,
    until,
    fromTime,
    untilTime,
    rateType,
    protectionPlan,
    expectedTotalCents,
    expectedInstantBook,
    confirmationTokenId,
    extras: pickedExtras,
    delivery: deliveryChoice,
    promoCode,
  } = parsed.data;

  const startsAt = zonedInstant(from, fromTime);
  const endsAt = zonedInstant(until, untilTime);
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

  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, date_of_birth, driving_license_verified, suspended_at")
    .eq("id", user.id)
    .single();
  if (!profile) return fail("Couldn't find your profile. Log in again.", 401);
  if (profile.suspended_at) return fail("Your account is on hold. Contact Cascade to book again.", 403);

  if (process.env.REQUIRE_DRIVER_CHECK === "true" && !profile.driving_license_verified) {
    return fail("Verify your driver's license on your profile before you book.", 403);
  }
  const driver = driverCheck(vehicle, profile.date_of_birth, from);
  if (!driver.ok) return fail(driver.message, driver.reason === "needs_dob" ? 400 : 403);

  // Extras are priced from the car's list, never from the request.
  let extras: ExtraLine[] = [];
  if (pickedExtras.length > 0) {
    const ids = [...new Set(pickedExtras.map((e) => e.id))];
    const { data: offered } = await admin
      .from("vehicle_extras")
      .select("id, name, per, price_cents, max_quantity, unlimited_miles")
      .eq("vehicle_id", vehicleId)
      .eq("active", true)
      .in("id", ids);
    if ((offered ?? []).length !== ids.length) {
      return fail("One of the extras isn't offered any more. Check the page again.", 409);
    }
    extras = ids.map((id) => {
      const extra = offered!.find((e) => e.id === id)!;
      const quantity = pickedExtras.filter((e) => e.id === id).reduce((sum, e) => sum + e.quantity, 0);
      return {
        id,
        name: extra.name,
        per: extra.per,
        price_cents: extra.price_cents,
        quantity: Math.min(quantity, extra.max_quantity),
        unlimited_miles: extra.unlimited_miles,
      };
    });
  }

  const delivered = quoteDelivery(vehicle, deliveryChoice);
  if (!delivered.ok) return fail(delivered.reason, 400);

  let promo = null;
  if (promoCode) {
    const result = await checkPromo(promoCode, user.id, days);
    if (!result.ok) return fail(result.error, 409);
    promo = result.terms;
  }

  const prices = await loadDailyPrices(vehicleId, from, until);
  const pricing = computePricing({
    dailyRateCents: vehicle.daily_rate_cents,
    days,
    dayRatesCents: dayRates(vehicle.daily_rate_cents, from, days, prices),
    protectionPlan,
    rateType,
    weeklyDiscountPct: vehicle.weekly_discount_pct,
    monthlyDiscountPct: vehicle.monthly_discount_pct,
    extras,
    deliveryCents: delivered.cents,
    youngDriverDailyCents: driver.youngDriverDailyCents,
    promo,
  });
  if (pricing.totalCents !== expectedTotalCents) {
    return fail("The price changed. Check the new total and try again.", 409);
  }
  if (vehicle.instant_book !== expectedInstantBook) {
    return fail("The host just changed how this car is booked. Check the page again.", 409);
  }

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
  const piBase = {
    amount: pricing.totalCents,
    currency: "usd",
    customer: customerId,
    capture_method: vehicle.instant_book ? "automatic" : "manual",
    // Keeps the card on the customer for the deposit hold and any charges after
    // the trip. Elements is set up with the same setupFutureUsage, as Stripe requires.
    setup_future_usage: "off_session",
    description: `${vehicle.year} ${vehicle.make} ${vehicle.model}, ${from} to ${until}`,
    metadata: {
      vehicle_id: vehicleId,
      guest_id: user.id,
      host_id: vehicle.host_id,
      from,
      until,
      ...(pricing.promoCode ? { promo_code: pricing.promoCode } : {}),
    },
  } as const;

  // When a ConfirmationToken is supplied we create and confirm in one step,
  // avoiding the dual-PI conflict that arises with Elements' deferred PI.
  // Elements is initialized with allowedPaymentMethodTypes: ["card"], so the
  // ConfirmationToken is card-scoped — use payment_method_types to match.
  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  let paymentIntent: Awaited<ReturnType<typeof stripe.paymentIntents.create>>;
  try {
    paymentIntent = confirmationTokenId
      ? await stripe.paymentIntents.create({
          ...piBase,
          confirm: true,
          confirmation_token: confirmationTokenId,
          payment_method_types: ["card"],
          return_url: `${origin}/trips`,
        })
      : await stripe.paymentIntents.create({
          ...piBase,
          // Legacy fallback (no ConfirmationToken): cards only, client confirms.
          payment_method_types: ["card"],
        });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Payment setup failed. Try again.";
    return fail(msg, 500);
  }

  const { data: trip, error } = await admin
    .from("trips")
    .insert({
      vehicle_id: vehicleId,
      guest_id: user.id,
      host_id: vehicle.host_id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      pickup_location: delivered.address ?? vehicle.location_name,
      daily_rate_cents: pricing.dailyRateCents,
      base_cents: pricing.baseCents,
      rental_cents: pricing.rentalCents,
      extras: pricing.extras.map((e) => ({
        id: e.id,
        name: e.name,
        per: e.per,
        price_cents: e.price_cents,
        quantity: e.quantity,
        total_cents: e.total_cents,
        unlimited_miles: !!e.unlimited_miles,
      })),
      extras_cents: pricing.extrasCents,
      unlimited_miles: pricing.extras.some((e) => e.unlimited_miles),
      delivery_cents: pricing.deliveryCents,
      delivery_address: delivered.address,
      delivery_lat: delivered.lat,
      delivery_lng: delivered.lng,
      young_driver_cents: pricing.youngDriverCents,
      promo_code: pricing.promoCode,
      promo_cents: pricing.promoCents,
      deposit_cents: vehicle.deposit_cents,
      subtotal_cents: pricing.subtotalCents,
      tax_cents: pricing.taxCents,
      total_cents: pricing.totalCents,
      distance_included_mi: vehicle.distance_included_mi,
      extra_mile_fee_cents: vehicle.extra_mile_fee_cents,
      rate_type: rateType,
      protection_plan: protectionPlan,
      protection_cost_cents: pricing.protectionCostCents,
      stripe_payment_intent_id: paymentIntent.id,
      stripe_payment_method_id:
        typeof paymentIntent.payment_method === "string"
          ? paymentIntent.payment_method
          : (paymentIntent.payment_method?.id ?? null),
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

  // For the ConfirmationToken flow: only send clientSecret if 3DS is needed.
  // For the legacy flow: always send it so the client can call confirmPayment.
  const clientSecret =
    confirmationTokenId
      ? paymentIntent.status === "requires_action" ? paymentIntent.client_secret : undefined
      : paymentIntent.client_secret;

  return NextResponse.json({ tripId: trip.id, ...(clientSecret ? { clientSecret } : {}) });
}
