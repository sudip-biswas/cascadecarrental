import { NON_REFUNDABLE_DISCOUNT, tripDays } from "@/lib/pricing";
import type { ChargeKind, Trip } from "@/lib/supabase/types";
import { formatPrice, pluralize } from "@/lib/utils";

export interface ReceiptLine {
  label: string;
  /** Shown under the label, e.g. "$12 a day × 3". */
  detail?: string;
  /** Negative for discounts. */
  cents: number;
}

/** "Receipt #3F9A2C1B": the start of the trip id, which is unique enough to quote. */
export function receiptNumber(tripId: string): string {
  return tripId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

/**
 * The pay-now discount, worked back from the rental after discounts. The trip
 * stores the rental before and after but not the two discounts apart.
 */
function payNowSavings(trip: Trip, rentalCents: number): number {
  if (trip.rate_type !== "non_refundable") return 0;
  const guess = Math.round(rentalCents / (1 - NON_REFUNDABLE_DISCOUNT));
  for (const before of [guess, guess - 1, guess + 1]) {
    const savings = Math.round(before * NON_REFUNDABLE_DISCOUNT);
    if (before - savings === rentalCents) return savings;
  }
  return guess - rentalCents;
}

/** Every line of a trip's bill, from the money stored on the trip. The total is trip.total_cents. */
export function receiptLines(trip: Trip): ReceiptLine[] {
  const days = tripDays(trip.starts_at, trip.ends_at);
  const base = trip.base_cents ?? trip.daily_rate_cents * days;
  // Trips booked before extras and delivery had only the subtotal.
  const rental = trip.rental_cents ?? trip.subtotal_cents - trip.extras_cents - trip.delivery_cents;
  const savings = Math.min(payNowSavings(trip, rental), Math.max(0, base - rental));
  const lengthDiscount = base - rental - savings;

  const lines: ReceiptLine[] = [
    {
      label: "Rental",
      detail:
        base === trip.daily_rate_cents * days
          ? `${pluralize(days, "day")} × ${formatPrice(trip.daily_rate_cents)}`
          : `${pluralize(days, "day")}, avg ${formatPrice(Math.round(base / days))} a day`,
      cents: base,
    },
  ];
  if (lengthDiscount > 0) {
    lines.push({ label: days >= 30 ? "Monthly discount" : days >= 7 ? "Weekly discount" : "Discount", cents: -lengthDiscount });
  }
  if (savings > 0) lines.push({ label: "Pay now discount", cents: -savings });

  for (const extra of trip.extras ?? []) {
    const each = `${formatPrice(extra.price_cents)}${extra.per === "day" ? " a day" : ""}`;
    lines.push({
      label: extra.quantity > 1 ? `${extra.name} × ${extra.quantity}` : extra.name,
      detail: extra.per === "day" ? `${each} × ${pluralize(days, "day")}` : extra.quantity > 1 ? `${each} each` : undefined,
      cents: extra.total_cents,
    });
  }
  if (trip.delivery_cents > 0) {
    lines.push({ label: "Delivery", cents: trip.delivery_cents });
  }
  if (trip.protection_cost_cents > 0) {
    lines.push({
      label: `${trip.protection_plan ? `${trip.protection_plan[0].toUpperCase()}${trip.protection_plan.slice(1)} ` : ""}protection`,
      cents: trip.protection_cost_cents,
    });
  }
  if (trip.young_driver_cents > 0) {
    lines.push({ label: "Young driver fee", detail: "Drivers under 25", cents: trip.young_driver_cents });
  }
  if (trip.promo_cents > 0) {
    lines.push({ label: trip.promo_code ? `Promo ${trip.promo_code}` : "Promo", cents: -trip.promo_cents });
  }
  lines.push({ label: "Tax, 10.9%", cents: trip.tax_cents });
  return lines;
}

export const CHARGE_LABEL: Record<ChargeKind, string> = {
  extra_miles: "Extra miles",
  fuel: "Fuel",
  tolls: "Tolls",
  cleaning: "Cleaning",
  smoking: "Smoking",
  late_return: "Late return",
  damage: "Damage",
  other: "Other charge",
};
