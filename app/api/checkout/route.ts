import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { computePricing, dayRates, lastMinuteBoostPct, tripDays, type ExtraLine } from "@/lib/pricing";
import { hasConflict, loadDailyPrices, releaseStaleCheckouts } from "@/lib/trips";
import { formatBuffer, loadHostHours, tripRuleProblem } from "@/lib/trip-rules";
import { formatCurrency, zonedInstant } from "@/lib/utils";
import { driverCheck } from "@/components/checkout/rules";
import { CAR_SPOT, loadPickupSpots, quotePickup } from "@/lib/locations";
import { checkPromo } from "@/app/api/promo/check";
import { PAID_WITH_LABEL, isPayOverTime, payOverTimeFor, type PaidWith } from "@/lib/pay-over-time";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The car's own spot, one of the host's named spots, or an address inside the custom radius. */
const delivery = z.object({
  spot: z.string().min(1).max(64),
  address: z.string().trim().min(3).max(300).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

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
  /** Paying over time: the card kept on file for the deposit and costs after the trip. */
  cardConfirmationTokenId: z.string().startsWith("ctoken_").optional(),
  /** The same card once its bank check (3-D Secure) is done, on the second try. */
  cardSetupIntentId: z.string().startsWith("seti_").optional(),
  fromTime: z.string().regex(/^\d{2}:\d{2}$/).default("10:00"),
  untilTime: z.string().regex(/^\d{2}:\d{2}$/).default("10:00"),
  /** Extras by id. Names and prices come from the car's own list. */
  extras: z.array(z.object({ id: z.string().uuid(), quantity: z.number().int().min(1).max(10) })).max(20).default([]),
  delivery: delivery.default({ spot: CAR_SPOT }),
  promoCode: z.string().trim().min(1).max(40).optional(),
});

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

type CardOnFile = { ok: true; paymentMethodId: string } | { ok: false; error: string } | { ok: "action"; clientSecret: string; setupIntentId: string };

/**
 * Saves the card a pay-over-time trip keeps on file, since the lender can't be
 * charged for the deposit or anything after the trip. A card that needs its
 * bank's check comes back to the browser first, then here again by its SetupIntent.
 */
async function keepCardOnFile(
  customerId: string,
  userId: string,
  tokenId: string | undefined,
  setupIntentId: string | undefined,
  returnUrl: string
): Promise<CardOnFile> {
  const missing = { ok: false, error: "Add a card for the deposit and any costs after the trip." } as const;
  try {
    if (setupIntentId) {
      const si = await stripe.setupIntents.retrieve(setupIntentId);
      const pm = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
      if (si.customer !== customerId || si.metadata?.user_id !== userId || si.status !== "succeeded" || !pm) return missing;
      return { ok: true, paymentMethodId: pm };
    }
    if (!tokenId) return missing;
    const si = await stripe.setupIntents.create({
      customer: customerId,
      confirm: true,
      confirmation_token: tokenId,
      usage: "off_session",
      payment_method_types: ["card"],
      return_url: returnUrl,
      metadata: { user_id: userId, kind: "card_on_file" },
    });
    const pm = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
    if (si.status === "succeeded" && pm) return { ok: true, paymentMethodId: pm };
    if (si.status === "requires_action" && si.client_secret) {
      return { ok: "action", clientSecret: si.client_secret, setupIntentId: si.id };
    }
    return { ok: false, error: "That card didn't go through. Try another." };
  } catch (err) {
    const declined = err instanceof Error && "type" in err && err.type === "StripeCardError";
    return { ok: false, error: declined ? "That card was declined. Try another." : "Couldn't save the card. Try again." };
  }
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
    cardConfirmationTokenId,
    cardSetupIntentId,
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
  const broken = tripRuleProblem(
    { ...vehicle, hours: await loadHostHours(admin, vehicle.host_id) },
    startsAt,
    endsAt
  );
  if (broken) return fail(broken, 400);

  await releaseStaleCheckouts(vehicleId, user.id);
  if (await hasConflict(vehicleId, startsAt, endsAt, vehicle.trip_buffer_hours)) {
    // A clash that only the buffer causes isn't someone else's booking.
    const bufferOnly = vehicle.trip_buffer_hours > 0 && !(await hasConflict(vehicleId, startsAt, endsAt));
    return fail(
      bufferOnly
        ? `The host needs ${formatBuffer(vehicle.trip_buffer_hours)} between trips. Try a later pick-up or an earlier return.`
        : "Someone just booked these dates. Try others.",
      409
    );
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

  // Spots and their prices come from the host's own list, never from the request.
  const spots = await loadPickupSpots(admin, vehicle);
  const delivered = quotePickup(vehicle, spots, deliveryChoice, days);
  if (!delivered.ok) return fail(delivered.reason, 409);
  const spot = delivered.spot;
  const custom = spot.kind === "custom";
  // The car's own spot keeps delivery_address empty, as before: the address is the car's.
  const handover =
    spot.kind === "car"
      ? { address: null, lat: null, lng: null }
      : custom
        ? { address: deliveryChoice.address!, lat: deliveryChoice.lat!, lng: deliveryChoice.lng! }
        : { address: spot.address ?? spot.name, lat: spot.lat, lng: spot.lng };

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
    discounts: vehicle,
    boostPct: lastMinuteBoostPct(vehicle, startsAt),
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

  const origin = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  // The trip's id is set here so the lenders' pages can send the guest straight back to it.
  const tripId = crypto.randomUUID();
  const returnUrl = `${origin}/trips/${tripId}?booked=1`;

  // Card, or one of the lenders the guest picked in the Payment Element.
  const token = confirmationTokenId ? await stripe.confirmationTokens.retrieve(confirmationTokenId).catch(() => null) : null;
  if (confirmationTokenId && !token) return fail("Your payment details expired. Enter them again.", 409);
  const previewType = token?.payment_method_preview?.type;
  if (previewType && previewType !== "card" && !isPayOverTime(previewType)) {
    return fail("Pay by card, Klarna, Affirm or Afterpay.", 400);
  }
  const paidWith: PaidWith = isPayOverTime(previewType) ? previewType : "card";
  if (paidWith !== "card" && !payOverTimeFor(pricing.totalCents).includes(paidWith)) {
    return fail(`${PAID_WITH_LABEL[paidWith]} doesn't take a trip of ${formatCurrency(pricing.totalCents)}. Pay by card instead.`, 400);
  }

  let cardOnFile: string | null = null;
  if (paidWith !== "card") {
    const card = await keepCardOnFile(customerId, user.id, cardConfirmationTokenId, cardSetupIntentId, returnUrl);
    if (card.ok === "action") {
      return NextResponse.json({ cardAction: { clientSecret: card.clientSecret, setupIntentId: card.setupIntentId } });
    }
    if (!card.ok) return fail(card.error, 402);
    cardOnFile = card.paymentMethodId;
  }

  // Instant-book cars are charged straight away. Otherwise the payment is only
  // held until the host accepts. Card and all three lenders can hold.
  const piBase = {
    amount: pricing.totalCents,
    currency: "usd",
    customer: customerId,
    capture_method: vehicle.instant_book ? "automatic" : "manual",
    description: `${vehicle.year} ${vehicle.make} ${vehicle.model}, ${from} to ${until}`,
    metadata: {
      trip_id: tripId,
      vehicle_id: vehicleId,
      guest_id: user.id,
      host_id: vehicle.host_id,
      from,
      until,
      ...(pricing.promoCode ? { promo_code: pricing.promoCode } : {}),
    },
  } as const;

  // Keeps a paying card on the customer for the deposit hold and any charges
  // after the trip. Elements sets this on cards only, so the token is matched:
  // a token that carries it gets it back, otherwise it goes on the card options.
  const keepCard = token?.setup_future_usage
    ? { setup_future_usage: token.setup_future_usage }
    : { payment_method_options: { card: { setup_future_usage: "off_session" as const } } };

  // The lenders want an address; a car rental has nothing to ship, so it's the billing one.
  const billing = token?.payment_method_preview?.billing_details;
  const shipping =
    paidWith !== "card" && !token?.shipping && billing?.name && billing.address?.line1
      ? {
          name: billing.name,
          address: {
            line1: billing.address.line1,
            line2: billing.address.line2 ?? undefined,
            city: billing.address.city ?? undefined,
            state: billing.address.state ?? undefined,
            postal_code: billing.address.postal_code ?? undefined,
            country: billing.address.country ?? "US",
          },
        }
      : undefined;

  // When a ConfirmationToken is supplied we create and confirm in one step,
  // avoiding the dual-PI conflict that arises with Elements' deferred PI.
  let paymentIntent: Awaited<ReturnType<typeof stripe.paymentIntents.create>>;
  try {
    paymentIntent = confirmationTokenId
      ? await stripe.paymentIntents.create({
          ...piBase,
          ...(paidWith === "card" ? keepCard : {}),
          confirm: true,
          confirmation_token: confirmationTokenId,
          payment_method_types: [paidWith],
          return_url: returnUrl,
          ...(shipping ? { shipping } : {}),
        })
      : await stripe.paymentIntents.create({
          ...piBase,
          setup_future_usage: "off_session",
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
      id: tripId,
      vehicle_id: vehicleId,
      guest_id: user.id,
      host_id: vehicle.host_id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      pickup_location: custom ? handover.address! : spot.name,
      daily_rate_cents: pricing.dailyRateCents,
      // The receipt shows a last-minute boost as part of the rental.
      base_cents: pricing.baseCents + pricing.boostCents,
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
      delivery_address: handover.address,
      delivery_lat: handover.lat,
      delivery_lng: handover.lng,
      pickup_spot_id: spot.kind === "car" ? null : spot.id,
      pickup_spot_kind: spot.kind,
      pickup_spot_name: custom ? null : spot.name,
      vehicle_access: spot.vehicle_access,
      handover_note: spot.handover_note,
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
      // On a pay-over-time trip, the card on file rather than the lender.
      stripe_payment_method_id:
        cardOnFile ??
        (typeof paymentIntent.payment_method === "string"
          ? paymentIntent.payment_method
          : (paymentIntent.payment_method?.id ?? null)),
      paid_with: paidWith,
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

  // Klarna, Affirm and Afterpay send the guest to their page, which comes back to the trip.
  const redirectUrl =
    paymentIntent.status === "requires_action" ? paymentIntent.next_action?.redirect_to_url?.url : undefined;
  if (redirectUrl) return NextResponse.json({ tripId: trip.id, redirectUrl });

  // For the ConfirmationToken flow: only send clientSecret if 3DS is needed.
  // For the legacy flow: always send it so the client can call confirmPayment.
  const clientSecret =
    confirmationTokenId
      ? paymentIntent.status === "requires_action" ? paymentIntent.client_secret : undefined
      : paymentIntent.client_secret;

  return NextResponse.json({ tripId: trip.id, ...(clientSecret ? { clientSecret } : {}) });
}
