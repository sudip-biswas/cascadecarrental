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

export interface PricingInput {
  dailyRateCents: number;
  days: number;
  protectionPlan?: ProtectionPlan | null;
  rateType?: RateType;
  weeklyDiscountPct?: number;
  monthlyDiscountPct?: number;
}

export interface PricingResult {
  dailyRateCents: number;
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
    dailyRateCents,
    days,
    protectionPlan,
    rateType = "non_refundable",
    weeklyDiscountPct = 0,
    monthlyDiscountPct = 0,
  } = input;

  const baseCents = dailyRateCents * days;
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
