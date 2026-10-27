import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { milesBetween } from "@/lib/pricing";
import { availableFor } from "./availability";
import { listedCars } from "./listings";
import type { SearchFilters } from "./params";
import { tripTotalCents, type ListedVehicle } from "./vehicle";

/** Miles from the searched place, when the guest picked one with a pin. */
export function distanceFrom(filters: Pick<SearchFilters, "lat" | "lng">, car: ListedVehicle) {
  if (filters.lat == null || filters.lng == null) return null;
  return milesBetween({ lat: filters.lat, lng: filters.lng }, { lat: car.location_lat, lng: car.location_lng });
}

/** The cars a search shows: filtered, free for the dates, in the order asked for. */
export async function searchCars(supabase: SupabaseClient<Database>, filters: SearchFilters) {
  let cars = await listedCars(supabase, filters);
  if (filters.dates) {
    const { from, until } = filters.dates;
    cars = await availableFor(cars, from, until);
    // Long-trip discounts can reorder cars, so sort by what the guest will pay.
    if (filters.sort === "price" || filters.sort === "price_high") {
      const sign = filters.sort === "price" ? 1 : -1;
      cars.sort((a, b) => sign * (tripTotalCents(a, from, until) - tripTotalCents(b, from, until)));
    }
  }
  if (filters.sort === "distance") {
    cars.sort((a, b) => (distanceFrom(filters, a) ?? 0) - (distanceFrom(filters, b) ?? 0));
  }
  return cars;
}

/**
 * The live count behind "Show 12 cars", plus the daily prices of every car the
 * other filters allow, for the price histogram.
 */
export async function searchStats(supabase: SupabaseClient<Database>, filters: SearchFilters) {
  const cars = await searchCars(supabase, { ...filters, minPrice: null, maxPrice: null, sort: "price" });
  const cents = cars.map((car) => car.daily_rate_cents);
  const count = cents.filter(
    (c) => (!filters.minPrice || c >= filters.minPrice * 100) && (!filters.maxPrice || c <= filters.maxPrice * 100)
  ).length;
  return { count, prices: cents.map((c) => c / 100) };
}

export type SearchStats = Awaited<ReturnType<typeof searchStats>>;
