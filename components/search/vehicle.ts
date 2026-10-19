import { computePricing } from "@/lib/pricing";
import { carPath } from "@/lib/site";
import { formatPrice } from "@/lib/utils";
import { VEHICLE_PUBLIC, type PublicVehicle } from "@/lib/supabase/columns";
import type { VehicleImage } from "@/lib/supabase/types";
import { daysBetween, type DateKey } from "./dates";

/** A listed car as search and the home page load it. */
export type ListedVehicle = PublicVehicle & {
  vehicle_images: VehicleImage[];
  host: { full_name: string } | null;
  persona: { name: string } | null;
};

/** Columns those pages select. */
export const LISTED_VEHICLE_SELECT = `${VEHICLE_PUBLIC}, vehicle_images(*), host:profiles!host_id(full_name), persona:host_personas!persona_id(name)`;

export function coverImage(images: VehicleImage[] | null | undefined) {
  if (!images?.length) return null;
  return images.find((img) => img.is_cover) ?? [...images].sort((a, b) => a.position - b.position)[0];
}

export function firstName(fullName: string | null | undefined) {
  return fullName?.trim().split(/\s+/)[0] || null;
}

/** Pay-now total for the dates, tax included: the number checkout starts on. */
export function tripTotalCents(vehicle: PublicVehicle, from: DateKey, until: DateKey) {
  return computePricing({
    dailyRateCents: vehicle.daily_rate_cents,
    days: daysBetween(from, until),
    rateType: "non_refundable",
    weeklyDiscountPct: vehicle.weekly_discount_pct,
    monthlyDiscountPct: vehicle.monthly_discount_pct,
  }).totalCents;
}

export function carHref(vehicle: PublicVehicle, dates?: { from: DateKey; until: DateKey } | null) {
  if (!dates) return carPath(vehicle);
  return `${carPath(vehicle)}?${new URLSearchParams(dates).toString()}`;
}

/** "$151": totals on cards are rounded to the dollar. Checkout shows the cents. */
export function roughPrice(cents: number) {
  return formatPrice(Math.round(cents / 100) * 100);
}
