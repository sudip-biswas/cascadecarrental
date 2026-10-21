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

/** A host's own prices for single days, in cents, keyed by Pacific date ("2026-10-18"). */
export type DailyPrices = Record<string, number>;

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

export interface PricingInput {
  dailyRateCents: number;
  days: number;
  /** Each day's rate, from dayRates. Replaces dailyRateCents × days when given. */
  dayRatesCents?: number[];
  protectionPlan?: ProtectionPlan | null;
  rateType?: RateType;
  weeklyDiscountPct?: number;
  monthlyDiscountPct?: number;
}

export interface PricingResult {
  /** The car's rate, or the average when days are priced differently. */
  dailyRateCents: number;
  /** True when the days don't all cost the same, so dailyRateCents is an average. */
  ratesVary: boolean;
  days: number;
  /** Rental before any discount. */
  baseCents: number;
  /** Weekly (7+ days) or monthly (30+ days) discount. */
  lengthDiscountCents: number;
  lengthDiscountPct: number;
  /** Pay-now discount. */
  savingsCents: number;
  /** Rental after discounts. This is what the host is paid from. */
  subtotalCents: number;
  protectionCostCents: number;
  taxCents: number;
  totalCents: number;
}

export function lengthDiscountPct(
  days: number,
  weeklyPct = 0,
  monthlyPct = 0
): number {
  if (days >= 30 && monthlyPct > 0) return monthlyPct;
  if (days >= 7 && weeklyPct > 0) return weeklyPct;
  return 0;
}

export function computePricing(input: PricingInput): PricingResult {
  const {
    days,
    dayRatesCents,
    protectionPlan,
    rateType = "non_refundable",
    weeklyDiscountPct = 0,
    monthlyDiscountPct = 0,
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
  const pct = lengthDiscountPct(days, weeklyDiscountPct, monthlyDiscountPct);
  const lengthDiscountCents = Math.round((baseCents * pct) / 100);
  const afterLength = baseCents - lengthDiscountCents;

  const savingsCents =
    rateType === "non_refundable" ? Math.round(afterLength * NON_REFUNDABLE_DISCOUNT) : 0;
  const subtotalCents = afterLength - savingsCents;

  const protectionCostCents = protectionPlan
    ? PROTECTION_DAILY_CENTS[protectionPlan] * days
    : 0;

  const taxCents = Math.round((subtotalCents + protectionCostCents) * TAX_RATE);
  const totalCents = subtotalCents + protectionCostCents + taxCents;

  return {
    dailyRateCents,
    ratesVary,
    days,
    baseCents,
    lengthDiscountCents,
    lengthDiscountPct: pct,
    savingsCents,
    subtotalCents,
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
