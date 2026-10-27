import { computePricing, lastMinuteBoostPct } from "@/lib/pricing";
import { carPath } from "@/lib/site";
import { formatPrice, zonedInstant } from "@/lib/utils";
import { VEHICLE_PUBLIC, type PublicVehicle } from "@/lib/supabase/columns";
import type { VehicleImage } from "@/lib/supabase/types";
import { daysBetween, type DateKey } from "./dates";

/** A listed car as search and the home page load it. */
export type ListedVehicle = PublicVehicle & {
  vehicle_images: VehicleImage[];
  host: { full_name: string } | null;
  persona: { name: string } | null;
  vehicle_extras: { unlimited_miles: boolean; active: boolean }[];
};

/** Columns those pages select. */
export const LISTED_VEHICLE_SELECT = `${VEHICLE_PUBLIC}, delivery_enabled, three_day_discount_pct, two_week_discount_pct, three_week_discount_pct, last_minute_boost_pct, vehicle_images(*), vehicle_extras(unlimited_miles, active), host:profiles!host_id(full_name), persona:host_personas!persona_id(name)`;

export function coverImage(images: VehicleImage[] | null | undefined) {
  if (!images?.length) return null;
  return images.find((img) => img.is_cover) ?? [...images].sort((a, b) => a.position - b.position)[0];
}

export function firstName(fullName: string | null | undefined) {
  return fullName?.trim().split(/\s+/)[0] || null;
}

/** Pay-now total for the dates, tax included: the number checkout starts on. */
export function tripTotalCents(vehicle: PublicVehicle, from: DateKey, until: DateKey) {
  return tripPrice(vehicle, from, until).totalCents;
}

/**
 * The trip total, and what it would be without the car's trip-length discount
 * (null when none applies), so cards can strike through the higher price.
 */
export function tripPrice(vehicle: PublicVehicle, from: DateKey, until: DateKey) {
  const input = {
    dailyRateCents: vehicle.daily_rate_cents,
    days: daysBetween(from, until),
    rateType: "non_refundable" as const,
    boostPct: lastMinuteBoostPct(vehicle, zonedInstant(from)),
  };
  const priced = computePricing({ ...input, discounts: vehicle });
  const full = priced.lengthDiscountCents > 0 ? computePricing({ ...input, discounts: {} }).totalCents : null;
  return { totalCents: priced.totalCents, beforeDiscountCents: full, discountLabel: priced.lengthDiscountLabel };
}

/** A car's listing offers an unlimited miles add-on. */
export function offersUnlimitedMiles(vehicle: ListedVehicle) {
  return vehicle.vehicle_extras?.some((e) => e.unlimited_miles && e.active) ?? false;
}

export function carHref(vehicle: PublicVehicle, dates?: { from: DateKey; until: DateKey } | null) {
  if (!dates) return carPath(vehicle);
  return `${carPath(vehicle)}?${new URLSearchParams(dates).toString()}`;
}

/** "$151": totals on cards are rounded to the dollar. Checkout shows the cents. */
export function roughPrice(cents: number) {
  return formatPrice(Math.round(cents / 100) * 100);
}

/** "0.6 mi" up close, "14 mi" further out. */
export function formatMiles(miles: number) {
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}
