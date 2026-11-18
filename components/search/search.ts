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
    cars = await availableFor(cars, from, until, filters.fromTime);
    // Long-trip discounts can reorder cars, so sort by what the guest will pay.
    if (filters.sort === "price" || filters.sort === "price_high") {
      const sign = filters.sort === "price" ? 1 : -1;
      cars.sort((a, b) => sign * (tripTotalCents(a, from, until) - tripTotalCents(b, from, until)));
    }
  }
  // Without dates, cards show today's dynamic price, so the order follows it.
  if (!filters.dates && (filters.sort === "price" || filters.sort === "price_high")) {
    const sign = filters.sort === "price" ? 1 : -1;
    const today = (car: ListedVehicle) => car.price_today_cents ?? car.daily_rate_cents;
    cars.sort((a, b) => sign * (today(a) - today(b)));
  }
  if (filters.sort === "distance") {
    cars.sort((a, b) => (distanceFrom(filters, a) ?? 0) - (distanceFrom(filters, b) ?? 0));
  }
  if (filters.sort === "recommended") {
    const price = (car: ListedVehicle) => car.price_today_cents ?? car.daily_rate_cents;
    cars.sort((a, b) => {
      const aReviewed = (a.trip_count ?? 0) > 0;
      const bReviewed = (b.trip_count ?? 0) > 0;
      if (aReviewed !== bReviewed) return aReviewed ? -1 : 1;
      if (aReviewed && bReviewed) {
        const rDiff = (b.rating_avg ?? 0) - (a.rating_avg ?? 0);
        if (rDiff !== 0) return rDiff;
      }
      if (a.instant_book !== b.instant_book) return a.instant_book ? -1 : 1;
      if (a.year !== b.year) return b.year - a.year;
      return price(a) - price(b);
    });
    // At most 2 of the same make+model in the first 12 results; push extras down.
    const head: ListedVehicle[] = [];
    const tail: ListedVehicle[] = [];
    const modelCount = new Map<string, number>();
    for (const car of cars) {
      const key = `${car.make}|${car.model}`;
      const count = modelCount.get(key) ?? 0;
      if (head.length < 12 && count < 2) {
        head.push(car);
        modelCount.set(key, count + 1);
      } else {
        tail.push(car);
      }
    }
    cars = [...head, ...tail];
  }
  return cars;
}

/**
 * The live count behind "Show 12 cars", plus the daily prices of every car the
 * other filters allow, for the price histogram.
 */
export async function searchStats(supabase: SupabaseClient<Database>, filters: SearchFilters) {
  const cars = await searchCars(supabase, { ...filters, minPrice: null, maxPrice: null, sort: "price" });
  const cents = cars.map((car) => car.price_today_cents ?? car.daily_rate_cents);
  const count = cents.filter(
    (c) => (!filters.minPrice || c >= filters.minPrice * 100) && (!filters.maxPrice || c <= filters.maxPrice * 100)
  ).length;
  return { count, prices: cents.map((c) => c / 100) };
}

export type SearchStats = Awaited<ReturnType<typeof searchStats>>;
