const TAX_RATE = 0.109; // ~10.9% blended tax rate

const PROTECTION_COSTS: Record<string, number> = {
  basic: 1199, // $11.99/day
  standard: 2199, // $21.99/day
  premium: 3499, // $34.99/day
};

const NON_REFUNDABLE_DISCOUNT = 0.09; // 9% discount

export interface PricingInput {
  dailyRateCents: number;
  days: number;
  protectionPlan?: "basic" | "standard" | "premium" | null;
  rateType?: "refundable" | "non_refundable";
}

export interface PricingResult {
  dailyRateCents: number;
  days: number;
  subtotalCents: number;
  protectionCostCents: number;
  taxCents: number;
  totalCents: number;
  savingsCents: number;
}

export function computePricing(input: PricingInput): PricingResult {
  const { dailyRateCents, days, protectionPlan, rateType = "non_refundable" } = input;

  let subtotalCents = dailyRateCents * days;

  const savingsCents =
    rateType === "non_refundable"
      ? Math.round(subtotalCents * NON_REFUNDABLE_DISCOUNT)
      : 0;
  subtotalCents -= savingsCents;

  const protectionCostCents = protectionPlan
    ? (PROTECTION_COSTS[protectionPlan] ?? 0) * days
    : 0;

  const taxCents = Math.round((subtotalCents + protectionCostCents) * TAX_RATE);
  const totalCents = subtotalCents + protectionCostCents + taxCents;

  return {
    dailyRateCents,
    days,
    subtotalCents,
    protectionCostCents,
    taxCents,
    totalCents,
    savingsCents,
  };
}
