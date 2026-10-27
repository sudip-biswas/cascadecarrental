const TAX_RATE = 0.109; // ~10.9% blended tax rate

export type ProtectionPlan = "basic" | "standard" | "premium";
export type RateType = "refundable" | "non_refundable";

export const PROTECTION_DAILY_CENTS: Record<ProtectionPlan, number> = {
  basic: 1199,
  standard: 2199,
  premium: 3499,
};

/** Discount for paying up front with no refund after 24 hours. */
export const NON_REFUNDABLE_DISCOUNT = 0.09;

/** Share of the rental subtotal paid out to the host. Tax and protection stay with Cascade. */
export const HOST_SHARE = 0.8;

/** Trip-length discounts, shortest first. A trip gets the best one it qualifies for, never a stack. */
export const DISCOUNT_TIERS = [
  { column: "three_day_discount_pct", days: 3, name: "3-day", label: "3+ day discount" },
  { column: "weekly_discount_pct", days: 7, name: "1-week", label: "1+ week discount" },
  { column: "two_week_discount_pct", days: 14, name: "2-week", label: "2+ week discount" },
  { column: "three_week_discount_pct", days: 21, name: "3-week", label: "3+ week discount" },
  { column: "monthly_discount_pct", days: 30, name: "1-month", label: "1+ month discount" },
] as const;

export type DiscountColumn = (typeof DISCOUNT_TIERS)[number]["column"];

/** A car's discount for each trip length, in percent. A vehicle row fits as is. */
export type DiscountTiers = Partial<Record<DiscountColumn, number>>;

/** The tier a trip of this many days gets, or null when none applies. */
export function bestDiscount(days: number, tiers: DiscountTiers): { pct: number; label: string } | null {
  let best: { pct: number; label: string } | null = null;
  for (const tier of DISCOUNT_TIERS) {
    const pct = tiers[tier.column] ?? 0;
    if (days >= tier.days && pct > 0 && pct >= (best?.pct ?? 0)) best = { pct, label: tier.label };
  }
  return best;
}

/** Pick-up this close to booking counts as last minute, so the car's boost applies. */
export const LAST_MINUTE_HOURS = 24;

/** True when pick-up is within 24 hours of booking: a same-day or next-morning trip. */
export function isLastMinute(startsAt: string | Date, bookedAt: string | Date = new Date()): boolean {
  return new Date(startsAt).getTime() - new Date(bookedAt).getTime() < LAST_MINUTE_HOURS * 3_600_000;
}

/** The car's boost if this trip is last minute, else 0. */
export function lastMinuteBoostPct(
  car: { last_minute_boost_pct?: number | null },
  startsAt: string | Date,
  bookedAt: string | Date = new Date()
): number {
  return car.last_minute_boost_pct && isLastMinute(startsAt, bookedAt) ? car.last_minute_boost_pct : 0;
}

/** A host's own prices for single days, in cents, keyed by Pacific date ("2026-10-18"). */
export type DailyPrices = Record<string, number>;

/** What a calendar price change did: each car's new day prices, null where it went back to the daily rate. */
export type PriceChanges = Record<string, Record<string, number | null>>;

/** What each day of a trip costs: the host's price for that day if they set one, else the car's rate. */
export function dayRates(
  dailyRateCents: number,
  fromKey: string,
  days: number,
  prices: DailyPrices = {}
): number[] {
  const start = Date.parse(`${fromKey}T12:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const key = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    return prices[key] ?? dailyRateCents;
  });
}

/** An extra on the bill, priced per day or once per trip. */
export interface ExtraLine {
  id: string;
  name: string;
  per: "day" | "trip";
  price_cents: number;
  quantity: number;
  unlimited_miles?: boolean;
}

export interface PricingInput {
  dailyRateCents: number;
  days: number;
  /** Each day's rate, from dayRates. Replaces dailyRateCents × days when given. */
  dayRatesCents?: number[];
  protectionPlan?: ProtectionPlan | null;
  rateType?: RateType;
  weeklyDiscountPct?: number;
  monthlyDiscountPct?: number;
  /** Every tier, e.g. the vehicle row. Wins over weeklyDiscountPct and monthlyDiscountPct. */
  discounts?: DiscountTiers;
  /** Last-minute boost in percent, from lastMinuteBoostPct. Zero when the trip isn't last minute. */
  boostPct?: number;
  extras?: ExtraLine[];
  deliveryCents?: number;
  /** Per day, for drivers under 25. Zero when it doesn't apply. */
  youngDriverDailyCents?: number;
  promo?: PromoTerms | null;
}

/** What a promo code takes off. Cascade pays for it, so it never lowers the host's share. */
export interface PromoTerms {
  code: string;
  percentOff: number | null;
  amountOffCents: number | null;
}

export interface PricingResult {
  /** The car's rate, or the average when days are priced differently. */
  dailyRateCents: number;
  /** True when the days don't all cost the same, so dailyRateCents is an average. */
  ratesVary: boolean;
  days: number;
  /** Rental before any boost or discount. */
  baseCents: number;
  /** Added for a last-minute trip. Discounts apply after it. */
  boostCents: number;
  boostPct: number;
  /** The best trip-length tier, e.g. 3+ days or 1+ week. */
  lengthDiscountCents: number;
  lengthDiscountPct: number;
  /** "3+ day discount", or null when no tier applies. */
  lengthDiscountLabel: string | null;
  /** Pay-now discount. */
  savingsCents: number;
  /** Rental after discounts. */
  rentalCents: number;
  extras: (ExtraLine & { total_cents: number })[];
  extrasCents: number;
  deliveryCents: number;
  /** Rental, extras and delivery. This is what the host is paid from. */
  subtotalCents: number;
  youngDriverCents: number;
  promoCode: string | null;
  promoCents: number;
  protectionCostCents: number;
  taxCents: number;
  totalCents: number;
}

/** Weekly (7+ days) or monthly (30+ days) discount on its own. */
export function lengthDiscountPct(days: number, weeklyPct = 0, monthlyPct = 0): number {
  return bestDiscount(days, { weekly_discount_pct: weeklyPct, monthly_discount_pct: monthlyPct })?.pct ?? 0;
}

export function computePricing(input: PricingInput): PricingResult {
  const {
    days,
    dayRatesCents,
    protectionPlan,
    rateType = "non_refundable",
    weeklyDiscountPct = 0,
    monthlyDiscountPct = 0,
    discounts,
    boostPct = 0,
    extras = [],
    deliveryCents = 0,
    youngDriverDailyCents = 0,
    promo = null,
  } = input;

  const baseCents = dayRatesCents
    ? dayRatesCents.reduce((sum, cents) => sum + cents, 0)
    : input.dailyRateCents * days;
  const ratesVary = !!dayRatesCents && dayRatesCents.some((cents) => cents !== dayRatesCents[0]);
  const dailyRateCents = dayRatesCents
    ? ratesVary
      ? Math.round(baseCents / days)
      : dayRatesCents[0]
    : input.dailyRateCents;
  const boostCents = Math.round((baseCents * boostPct) / 100);
  const boostedCents = baseCents + boostCents;
  const tier = bestDiscount(
    days,
    discounts ?? { weekly_discount_pct: weeklyDiscountPct, monthly_discount_pct: monthlyDiscountPct }
  );
  const pct = tier?.pct ?? 0;
  const lengthDiscountCents = Math.round((boostedCents * pct) / 100);
  const afterLength = boostedCents - lengthDiscountCents;

  const savingsCents =
    rateType === "non_refundable" ? Math.round(afterLength * NON_REFUNDABLE_DISCOUNT) : 0;
  const rentalCents = afterLength - savingsCents;

  const pricedExtras = extras
    .filter((e) => e.quantity > 0)
    .map((e) => ({ ...e, total_cents: e.price_cents * e.quantity * (e.per === "day" ? days : 1) }));
  const extrasCents = pricedExtras.reduce((sum, e) => sum + e.total_cents, 0);
  const subtotalCents = rentalCents + extrasCents + deliveryCents;

  const protectionCostCents = protectionPlan
    ? PROTECTION_DAILY_CENTS[protectionPlan] * days
    : 0;
  const youngDriverCents = youngDriverDailyCents * days;

  const beforePromo = subtotalCents + protectionCostCents + youngDriverCents;
  const promoCents = promo
    ? Math.min(
        beforePromo,
        promo.percentOff ? Math.round((rentalCents * promo.percentOff) / 100) : (promo.amountOffCents ?? 0)
      )
    : 0;

  const taxCents = Math.round((beforePromo - promoCents) * TAX_RATE);
  const totalCents = beforePromo - promoCents + taxCents;

  return {
    dailyRateCents,
    ratesVary,
    days,
    baseCents,
    boostCents,
    boostPct: boostCents > 0 ? boostPct : 0,
    lengthDiscountCents,
    lengthDiscountPct: pct,
    lengthDiscountLabel: tier?.label ?? null,
    savingsCents,
    rentalCents,
    extras: pricedExtras,
    extrasCents,
    deliveryCents,
    subtotalCents,
    youngDriverCents,
    promoCode: promoCents > 0 && promo ? promo.code : null,
    promoCents,
    protectionCostCents,
    taxCents,
    totalCents,
  };
}

/**
 * Days billed for a trip. Handovers are at the same wall-clock time, so this
 * rounds: a night across a clock change is 23 or 25 hours, still one day.
 */
export function tripDays(startsAt: string | Date, endsAt: string | Date): number {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

export function hostEarningsCents(subtotalCents: number): number {
  return Math.round(subtotalCents * HOST_SHARE);
}

/** What the host takes home from a flexible trip at the car's rate, after a discount and Cascade's fee. */
export function takeHomeCents(dailyRateCents: number, days: number, discountPct = 0): number {
  const base = dailyRateCents * days;
  return hostEarningsCents(base - Math.round((base * discountPct) / 100));
}

/** Under this age a driver pays the car's young driver fee. */
export const YOUNG_DRIVER_AGE = 25;

/** Whole years old on a given day. */
export function ageOn(dateOfBirth: string, on: Date): number {
  const [y, m, d] = dateOfBirth.split("-").map(Number);
  const onY = on.getUTCFullYear();
  const onM = on.getUTCMonth() + 1;
  const onD = on.getUTCDate();
  return onY - y - (onM < m || (onM === m && onD < d) ? 1 : 0);
}

/** Miles between two points, as the crow flies. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}

export interface DeliverySettings {
  delivery_enabled: boolean;
  delivery_radius_mi: number;
  delivery_fee_cents: number;
  delivery_fee_per_mi_cents: number;
  airport_delivery_fee_cents: number | null;
  location_lat: number;
  location_lng: number;
}

/** Sea-Tac's arrivals curb. Airport delivery goes here at the host's airport price. */
export const AIRPORT = { name: "Seattle-Tacoma International Airport", lat: 47.4436, lng: -122.3016 };

export type DeliveryQuote =
  | { ok: true; cents: number; miles: number }
  | { ok: false; reason: string };

/** What delivering the car to a spot costs, or why it can't go there. */
export function deliveryQuote(
  car: DeliverySettings,
  to: { lat: number; lng: number; airport?: boolean }
): DeliveryQuote {
  if (to.airport) {
    if (car.airport_delivery_fee_cents == null) return { ok: false, reason: "This host doesn't deliver to the airport." };
    return { ok: true, cents: car.airport_delivery_fee_cents, miles: milesBetween({ lat: car.location_lat, lng: car.location_lng }, AIRPORT) };
  }
  if (!car.delivery_enabled) return { ok: false, reason: "This host doesn't deliver." };
  const miles = milesBetween({ lat: car.location_lat, lng: car.location_lng }, to);
  if (miles > car.delivery_radius_mi) {
    return { ok: false, reason: `That's ${Math.round(miles)} mi away. This host delivers up to ${car.delivery_radius_mi} mi.` };
  }
  return { ok: true, cents: car.delivery_fee_cents + Math.round(miles * car.delivery_fee_per_mi_cents), miles };
}
