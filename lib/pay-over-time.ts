/**
 * Pay over time: Klarna, Affirm and Afterpay at checkout. Stripe sends the
 * guest to the lender's page and back, and the lender pays Cascade up front.
 * None of them can be charged again later, so a trip paid this way also keeps
 * a card on file for the deposit and costs after the trip, as Turo does.
 */

export const PAY_OVER_TIME = ["klarna", "affirm", "afterpay_clearpay"] as const;

export type PayOverTime = (typeof PAY_OVER_TIME)[number];
export type PaidWith = "card" | PayOverTime;

/** What each lender takes in the US, in cents. Stripe's published limits. */
const LIMITS: Record<PayOverTime, { min: number; max: number }> = {
  klarna: { min: 10_00, max: 10_000_00 },
  affirm: { min: 50_00, max: 30_000_00 },
  afterpay_clearpay: { min: 1_00, max: 4_000_00 },
};

export const PAID_WITH_LABEL: Record<PaidWith, string> = {
  card: "Card",
  klarna: "Klarna",
  affirm: "Affirm",
  afterpay_clearpay: "Afterpay",
};

export function isPayOverTime(type: string | null | undefined): type is PayOverTime {
  return PAY_OVER_TIME.includes(type as PayOverTime);
}

/** The lenders that take a trip of this total. */
export function payOverTimeFor(totalCents: number, enabled = payOverTimeEnabled()): PayOverTime[] {
  if (!enabled) return [];
  return PAY_OVER_TIME.filter((t) => totalCents >= LIMITS[t].min && totalCents <= LIMITS[t].max);
}

/** On by default; NEXT_PUBLIC_PAY_OVER_TIME=off hides it everywhere. */
export function payOverTimeEnabled() {
  return process.env.NEXT_PUBLIC_PAY_OVER_TIME !== "off";
}
