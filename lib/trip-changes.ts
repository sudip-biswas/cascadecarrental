import { createAdminClient } from "@/lib/supabase/admin";
import type { Trip, TripChange, TripExtra, Vehicle } from "@/lib/supabase/types";
import { freeCancellationUntil } from "@/lib/cancellation";
import { computePricing, dayRates, lastMinuteBoostPct, tripDays, type ExtraLine } from "@/lib/pricing";
import { holdsDates, loadDailyPrices } from "@/lib/trips";
import { changeRuleProblem, loadHostHours, withBuffer } from "@/lib/trip-rules";
import { formatDay, formatPrice, formatTime, pluralize, toDateKey } from "@/lib/utils";

/** Trips whose dates can still change. */
export const CHANGEABLE_STATUSES: Trip["status"][] = ["approved", "active"];

type QuoteTrip = Pick<
  Trip,
  | "id"
  | "vehicle_id"
  | "guest_id"
  | "status"
  | "payment_status"
  | "starts_at"
  | "ends_at"
  | "rate_type"
  | "protection_plan"
  | "extras"
  | "delivery_cents"
  | "young_driver_cents"
  | "promo_code"
  | "promo_cents"
  | "total_cents"
  | "created_at"
  | "approved_at"
>;

type QuoteVehicle = Pick<
  Vehicle,
  | "daily_rate_cents"
  | "weekly_discount_pct"
  | "monthly_discount_pct"
  | "three_day_discount_pct"
  | "two_week_discount_pct"
  | "three_week_discount_pct"
  | "last_minute_boost_pct"
  | "min_trip_days"
  | "max_trip_days"
>;

/** The trip's money after a change, as stored on trip_changes.pricing and copied onto the trip on accept. */
export interface ChangePricing {
  days: number;
  dailyRateCents: number;
  baseCents: number;
  rentalCents: number;
  extras: TripExtra[];
  extrasCents: number;
  deliveryCents: number;
  subtotalCents: number;
  youngDriverCents: number;
  promoCents: number;
  protectionCostCents: number;
  taxCents: number;
  totalCents: number;
  /** What the new dates would cost before the no-refund rule. Same as totalCents unless that rule kept the old price. */
  repricedTotalCents: number;
  /** False when a cheaper trip is past free cancellation, so the price stays as it was. */
  refunds: boolean;
}

export type ChangeQuote =
  | {
      ok: true;
      startsAt: Date;
      endsAt: Date;
      pricing: ChangePricing;
      /** Charged when positive, refunded when negative. */
      differenceCents: number;
      /** One line for the guest, e.g. "You'll pay $64.00 more when the host accepts." */
      summary: string;
    }
  | { ok: false; reason: string; status: number };

const SELECT_TRIP =
  "id, vehicle_id, guest_id, status, payment_status, starts_at, ends_at, rate_type, protection_plan, extras, delivery_cents, young_driver_cents, promo_code, promo_cents, total_cents, created_at, approved_at";

export async function loadQuoteTrip(tripId: string) {
  const { data } = await createAdminClient().from("trips").select(SELECT_TRIP).eq("id", tripId).maybeSingle();
  return data as QuoteTrip | null;
}

/** True when the car is booked or blocked for any part of [start, end) by anything but this trip. */
export async function hasOtherConflict(trip: Pick<Trip, "id" | "vehicle_id">, start: Date, end: Date) {
  const admin = createAdminClient();
  // Other trips count as the car's buffer longer on both ends, as at checkout.
  const buffer = withBuffer({ from: start.toISOString(), to: end.toISOString() }, await bufferHoursOf(trip.vehicle_id));
  const [trips, blocks] = await Promise.all([
    admin
      .from("trips")
      .select("id")
      .eq("vehicle_id", trip.vehicle_id)
      .neq("id", trip.id)
      .not("status", "in", '("cancelled_guest","cancelled_host")')
      .or(holdsDates())
      .lt("starts_at", buffer.to)
      .gt("ends_at", buffer.from)
      .limit(1),
    admin
      .from("vehicle_availability")
      .select("id")
      .eq("vehicle_id", trip.vehicle_id)
      .lt("blocked_from", end.toISOString())
      .gt("blocked_to", start.toISOString())
      .limit(1),
  ]);
  if (trips.error) throw trips.error;
  if (blocks.error) throw blocks.error;
  return trips.data.length > 0 || blocks.data.length > 0;
}

async function bufferHoursOf(vehicleId: string) {
  const { data } = await createAdminClient().from("vehicles").select("trip_buffer_hours").eq("id", vehicleId).maybeSingle();
  return data?.trip_buffer_hours ?? 0;
}

/** Booked and blocked ranges for the trip's car, leaving the trip itself out, for the change picker. */
export async function otherRanges(trip: Pick<Trip, "id" | "vehicle_id">) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const [buffer, { data: trips }, { data: blocks }] = await Promise.all([
    bufferHoursOf(trip.vehicle_id),
    admin
      .from("trips")
      .select("starts_at, ends_at")
      .eq("vehicle_id", trip.vehicle_id)
      .neq("id", trip.id)
      .not("status", "in", '("cancelled_guest","cancelled_host")')
      .or(holdsDates())
      .gt("ends_at", now),
    admin
      .from("vehicle_availability")
      .select("blocked_from, blocked_to")
      .eq("vehicle_id", trip.vehicle_id)
      .gt("blocked_to", now),
  ]);
  return [
    ...(trips ?? []).map((t) => withBuffer({ from: t.starts_at, to: t.ends_at }, buffer)),
    ...(blocks ?? []).map((b) => ({ from: b.blocked_from, to: b.blocked_to })),
  ];
}

/**
 * Whether a cheaper trip gives money back: always on the free-cancellation
 * rate, otherwise only before free cancellation ends.
 */
export function refundsDifference(trip: Pick<Trip, "rate_type" | "created_at" | "approved_at" | "starts_at">, now = new Date()) {
  return trip.rate_type === "refundable" || now < freeCancellationUntil(trip);
}

/**
 * Prices the trip for new dates the way checkout does: the car's rate and day
 * prices today, the trip's own rate type, protection, extras, delivery and
 * young driver fee, with the promo kept at the amount it took off.
 */
export function priceChange(
  trip: QuoteTrip,
  vehicle: QuoteVehicle,
  startsAt: Date,
  endsAt: Date,
  prices: Record<string, number>,
  now = new Date()
): { pricing: ChangePricing; differenceCents: number } {
  const days = tripDays(startsAt, endsAt);
  const oldDays = tripDays(trip.starts_at, trip.ends_at);
  const extras: ExtraLine[] = (trip.extras ?? []).map((e) => ({
    id: e.id,
    name: e.name,
    per: e.per,
    price_cents: e.price_cents,
    quantity: e.quantity,
    unlimited_miles: e.unlimited_miles,
  }));
  const p = computePricing({
    dailyRateCents: vehicle.daily_rate_cents,
    days,
    dayRatesCents: dayRates(vehicle.daily_rate_cents, toDateKey(startsAt), days, prices),
    protectionPlan: trip.protection_plan,
    rateType: trip.rate_type,
    discounts: vehicle,
    // A trip booked last minute keeps its boost while its pick-up stays put.
    boostPct:
      startsAt.getTime() === new Date(trip.starts_at).getTime() ? lastMinuteBoostPct(vehicle, trip.starts_at, trip.created_at) : 0,
    extras,
    deliveryCents: trip.delivery_cents,
    youngDriverDailyCents: Math.round(trip.young_driver_cents / oldDays),
    promo: trip.promo_cents > 0 ? { code: trip.promo_code ?? "", percentOff: null, amountOffCents: trip.promo_cents } : null,
  });

  const pricing: ChangePricing = {
    days,
    dailyRateCents: p.dailyRateCents,
    baseCents: p.baseCents + p.boostCents,
    rentalCents: p.rentalCents,
    extras: p.extras.map((e) => ({ ...e, unlimited_miles: e.unlimited_miles ?? false })),
    extrasCents: p.extrasCents,
    deliveryCents: p.deliveryCents,
    subtotalCents: p.subtotalCents,
    youngDriverCents: p.youngDriverCents,
    promoCents: p.promoCents,
    protectionCostCents: p.protectionCostCents,
    taxCents: p.taxCents,
    totalCents: p.totalCents,
    repricedTotalCents: p.totalCents,
    refunds: true,
  };
  const difference = p.totalCents - trip.total_cents;
  if (difference < 0 && !refundsDifference(trip, now)) {
    // Past free cancellation a shorter trip keeps its price, so the trip keeps its money columns.
    return { pricing: { ...pricing, refunds: false, totalCents: trip.total_cents }, differenceCents: 0 };
  }
  return { pricing, differenceCents: difference };
}

/** Everything a guest needs to know before asking for new dates, or why they can't. */
export async function quoteChange(trip: QuoteTrip, startsAt: Date, endsAt: Date, now = new Date()): Promise<ChangeQuote> {
  const no = (reason: string, status = 400): ChangeQuote => ({ ok: false, reason, status });

  if (!CHANGEABLE_STATUSES.includes(trip.status)) return no("This trip can't be changed any more.", 409);
  if (trip.payment_status !== "captured") return no("This trip isn't paid yet, so it can't be changed.", 409);
  if (endsAt <= startsAt) return no("The return has to be after pick-up.");
  if (endsAt <= now) return no("The new return has to be in the future.");
  if (new Date(trip.ends_at) <= now) return no("This trip has already ended.", 409);

  const startMoved = startsAt.getTime() !== new Date(trip.starts_at).getTime();
  if (startMoved && (trip.status === "active" || new Date(trip.starts_at) <= now)) {
    return no("The trip has started, so only the return can move.");
  }
  if (startMoved && startsAt <= now) return no("Pick-up has to be in the future.");
  if (!startMoved && endsAt.getTime() === new Date(trip.ends_at).getTime()) {
    return no("Those are the dates you already have.");
  }

  const admin = createAdminClient();
  const { data: vehicle } = await admin
    .from("vehicles")
    .select(
      "host_id, daily_rate_cents, weekly_discount_pct, monthly_discount_pct, three_day_discount_pct, two_week_discount_pct, three_week_discount_pct, last_minute_boost_pct, min_trip_days, max_trip_days, weekend_min_two_days"
    )
    .eq("id", trip.vehicle_id)
    .single();
  if (!vehicle) return no("This car isn't available any more.", 404);

  const days = tripDays(startsAt, endsAt);
  if (days < vehicle.min_trip_days) return no(`This car needs at least ${pluralize(vehicle.min_trip_days, "day")}.`);
  if (vehicle.max_trip_days && days > vehicle.max_trip_days) {
    return no(`This car can be booked for up to ${pluralize(vehicle.max_trip_days, "day")}.`);
  }

  const broken = changeRuleProblem(
    { weekend_min_two_days: vehicle.weekend_min_two_days, hours: await loadHostHours(admin, vehicle.host_id) },
    startsAt,
    endsAt,
    { start: startMoved, end: endsAt.getTime() !== new Date(trip.ends_at).getTime() }
  );
  if (broken) return no(broken);

  if (await hasOtherConflict(trip, startsAt, endsAt)) return no("The car is booked for some of those dates.", 409);

  const fromKey = toDateKey(startsAt);
  const prices = await loadDailyPrices(trip.vehicle_id, fromKey, toDateKey(endsAt));
  const { pricing, differenceCents } = priceChange(trip, vehicle, startsAt, endsAt, prices, now);

  return { ok: true, startsAt, endsAt, pricing, differenceCents, summary: quoteSummary(pricing, differenceCents) };
}

export function quoteSummary(pricing: ChangePricing, differenceCents: number): string {
  if (differenceCents > 0) return `You'll pay ${formatPrice(differenceCents)} more when the host accepts.`;
  if (differenceCents < 0) return `You'll get ${formatPrice(-differenceCents)} back when the host accepts.`;
  if (!pricing.refunds) return "It's past free cancellation, so the price stays the same and there's no refund.";
  return "The price stays the same.";
}

function when(next: string, old: string) {
  const sameDay = toDateKey(next) === toDateKey(old);
  const sameTime = formatTime(next) === formatTime(old);
  return `${formatDay(next)} ${formatTime(next)} instead of ${sameDay ? formatTime(old) : sameTime ? formatDay(old) : `${formatDay(old)} ${formatTime(old)}`}`;
}

/** "Return Fri Oct 31 10:00 instead of Thu Oct 30, $64 more" */
export function describeChange(
  change: Pick<TripChange, "old_starts_at" | "old_ends_at" | "new_starts_at" | "new_ends_at" | "difference_cents"> & {
    pricing: unknown;
  }
): string {
  const parts: string[] = [];
  if (new Date(change.new_starts_at).getTime() !== new Date(change.old_starts_at).getTime()) {
    parts.push(`Pick-up ${when(change.new_starts_at, change.old_starts_at)}`);
  }
  if (new Date(change.new_ends_at).getTime() !== new Date(change.old_ends_at).getTime()) {
    parts.push(`Return ${when(change.new_ends_at, change.old_ends_at)}`);
  }
  const pricing = change.pricing as ChangePricing;
  const money =
    change.difference_cents > 0
      ? `${formatPrice(change.difference_cents)} more`
      : change.difference_cents < 0
        ? `${formatPrice(-change.difference_cents)} less`
        : pricing.refunds === false
          ? "same price, no refund"
          : "same price";
  const text = [...parts, money].join(", ");
  return text[0].toUpperCase() + text.slice(1);
}
