import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { SEA_BOUNDS } from "./categories";
import type { SearchFilters } from "./params";
import { LISTED_VEHICLE_SELECT, type ListedVehicle } from "./vehicle";

/** Enough for every car in a young marketplace. */
const MAX_RESULTS = 200;

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * ~50 km radius expressed in degrees.
 * At Seattle's latitude (~47.5°N) 1° lng ≈ 75 km, 1° lat ≈ 111 km.
 */
const SEARCH_RADIUS = { lat: 0.45, lng: 0.60 };

/** Listed cars matching the filters, before any date check. */
export async function listedCars(supabase: SupabaseClient<Database>, filters: Partial<SearchFilters>) {
  let query = supabase.from("vehicles").select(LISTED_VEHICLE_SELECT).eq("status", "listed");

  if (filters.types?.length) query = query.in("vehicle_type", filters.types);
  if (filters.fuels?.length) query = query.in("fuel_type", filters.fuels);
  if (filters.minSeats) query = query.gte("seats", filters.minSeats);
  if (filters.maxPrice) query = query.lte("daily_rate_cents", filters.maxPrice * 100);
  if (filters.instant) query = query.eq("instant_book", true);
  if (filters.weekDiscount) query = query.gt("weekly_discount_pct", 0);

  if (filters.lat != null && filters.lng != null) {
    // Precise pick from autocomplete — search by proximity bounding box
    query = query
      .gte("location_lat", filters.lat - SEARCH_RADIUS.lat)
      .lte("location_lat", filters.lat + SEARCH_RADIUS.lat)
      .gte("location_lng", filters.lng - SEARCH_RADIUS.lng)
      .lte("location_lng", filters.lng + SEARCH_RADIUS.lng);
  } else if (filters.where) {
    // Manual text entry — fall back to location_name substring match
    query = query.ilike("location_name", `%${escapeLike(filters.where)}%`);
  }

  if (filters.nearSea) {
    query = query
      .gte("location_lat", SEA_BOUNDS.minLat)
      .lte("location_lat", SEA_BOUNDS.maxLat)
      .gte("location_lng", SEA_BOUNDS.minLng)
      .lte("location_lng", SEA_BOUNDS.maxLng);
  }

  query =
    filters.sort === "rating"
      ? query.order("rating_avg", { ascending: false, nullsFirst: false })
      : filters.sort === "newest"
        ? query.order("created_at", { ascending: false })
        : query.order("daily_rate_cents", { ascending: true });

  const { data, error } = await query.limit(MAX_RESULTS);
  if (error) throw error;
  return data as unknown as ListedVehicle[];
}
