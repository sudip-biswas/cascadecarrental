import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { FEATURES, SEA_BOUNDS } from "./categories";
import type { SearchFilters } from "./params";
import { LISTED_VEHICLE_SELECT, type ListedVehicle } from "./vehicle";
import { withTodayPrices } from "./prices";

type Client = SupabaseClient<Database>;

/** Enough for every car in a young marketplace. */
const MAX_RESULTS = 200;

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** A value quoted for a PostgREST or() filter, so commas and brackets in it are safe. */
function quoted(value: string) {
  return `"${value.replace(/["\\]/g, (c) => `\\${c}`)}"`;
}

/**
 * ~50 km radius expressed in degrees.
 * At Seattle's latitude (~47.5°N) 1° lng ≈ 75 km, 1° lat ≈ 111 km.
 */
const SEARCH_RADIUS = { lat: 0.45, lng: 0.60 };

function listedQuery(supabase: Client) {
  return supabase.from("vehicles").select(LISTED_VEHICLE_SELECT).eq("status", "listed");
}

/**
 * Cars the host will bring to the guest's own address, as an or() filter: the
 * host has delivery to an address switched on, for all their cars or this one.
 * Guests can't read host locations, so this looks them up with the admin client.
 */
async function deliveryFilter(): Promise<string> {
  const { data } = await createAdminClient()
    .from("host_locations")
    .select("host_id, all_vehicles, host_location_vehicles(vehicle_id)")
    .eq("kind", "custom")
    .eq("enabled", true);
  const hosts = (data ?? []).filter((l) => l.all_vehicles).map((l) => l.host_id);
  const cars = (data ?? []).flatMap((l) => (l.all_vehicles ? [] : l.host_location_vehicles.map((v) => v.vehicle_id)));
  // A nil id matches nothing when no host delivers.
  if (!hosts.length && !cars.length) return "id.eq.00000000-0000-0000-0000-000000000000";
  return [hosts.length && `host_id.in.(${hosts})`, cars.length && `id.in.(${cars})`].filter(Boolean).join(",");
}

/** "Toyota" and "Toyota:RAV4" picks as one or() filter: a make alone means any of its models. */
function makeModelFilter(makes: string[], models: string[]) {
  const byMake = new Map<string, string[]>(makes.map((make) => [make, []]));
  for (const pair of models) {
    const [make, model] = pair.split(":");
    if (make && model) byMake.set(make, [...(byMake.get(make) ?? []), model]);
  }
  return [...byMake]
    .map(([make, names]) =>
      names.length
        ? `and(make.eq.${quoted(make)},model.in.(${names.map(quoted).join(",")}))`
        : `make.eq.${quoted(make)}`
    )
    .join(",");
}

/**
 * Ids of the cars that have every picked feature and, when asked, an unlimited
 * miles add-on. Null when neither filter is on.
 */
async function matchingIds(supabase: Client, filters: Partial<SearchFilters>) {
  const names = (filters.features ?? []).flatMap((slug) => FEATURES.find((f) => f.value === slug)?.label ?? []);
  const sets: Set<string>[] = [];

  if (names.length) {
    const { data, error } = await supabase.from("vehicle_features").select("vehicle_id, feature").in("feature", names);
    if (error) throw error;
    const found = new Map<string, Set<string>>();
    for (const row of data) found.set(row.vehicle_id, (found.get(row.vehicle_id) ?? new Set()).add(row.feature));
    sets.push(new Set([...found].filter(([, have]) => have.size === names.length).map(([id]) => id)));
  }

  if (filters.miles === "unlimited") {
    const { data, error } = await supabase
      .from("vehicle_extras")
      .select("vehicle_id")
      .eq("unlimited_miles", true)
      .eq("active", true);
    if (error) throw error;
    sets.push(new Set(data.map((row) => row.vehicle_id)));
  }

  if (!sets.length) return null;
  return [...sets[0]].filter((id) => sets.every((set) => set.has(id)));
}

/** Listed cars matching the filters, before any date check. */
export async function listedCars(supabase: Client, filters: Partial<SearchFilters>) {
  const ids = await matchingIds(supabase, filters);
  if (ids && !ids.length) return [];

  let query = listedQuery(supabase);
  if (ids) query = query.in("id", ids);

  if (filters.types?.length) query = query.in("vehicle_type", filters.types);
  if (filters.fuels?.length) query = query.in("fuel_type", filters.fuels);
  if (filters.minSeats) query = query.gte("seats", filters.minSeats);
  if (filters.minPrice) query = query.gte("daily_rate_cents", filters.minPrice * 100);
  if (filters.maxPrice) query = query.lte("daily_rate_cents", filters.maxPrice * 100);
  if (filters.makes?.length || filters.models?.length) {
    query = query.or(makeModelFilter(filters.makes ?? [], filters.models ?? []));
  }
  if (filters.minYear) query = query.gte("year", filters.minYear);
  if (filters.maxYear) query = query.lte("year", filters.maxYear);
  // Electric cars have no MPG; they beat any figure a guest asks for.
  if (filters.minMpg) query = query.or(`mpg.gte.${filters.minMpg},fuel_type.eq.electric`);
  if (filters.transmission) query = query.eq("transmission", filters.transmission);
  if (typeof filters.miles === "number") query = query.gte("distance_included_mi", filters.miles);
  if (filters.delivery) query = query.or(await deliveryFilter());
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

  // Distance is sorted after the fetch, from the cheapest up until then.
  query =
    filters.sort === "rating"
      ? query.order("rating_avg", { ascending: false, nullsFirst: false })
      : filters.sort === "newest"
        ? query.order("created_at", { ascending: false })
        : filters.sort === "price_high"
          ? query.order("daily_rate_cents", { ascending: false })
          : query.order("daily_rate_cents", { ascending: true });

  const { data, error } = await query.limit(MAX_RESULTS);
  if (error) throw error;
  return withTodayPrices(data as unknown as ListedVehicle[]);
}

/** What the filter menus offer: every listed make with its models, the year span and the top daily price. */
export async function filterOptions(supabase: Client) {
  const { data, error } = await supabase
    .from("vehicles")
    .select("make, model, year, daily_rate_cents")
    .eq("status", "listed");
  if (error) throw error;
  const makes = new Map<string, Set<string>>();
  for (const car of data) makes.set(car.make, (makes.get(car.make) ?? new Set()).add(car.model));
  const years = data.map((car) => car.year);
  return {
    makes: [...makes]
      .map(([make, models]) => ({ make, models: [...models].sort() }))
      .sort((a, b) => a.make.localeCompare(b.make)),
    years: years.length ? { min: Math.min(...years), max: Math.max(...years) } : null,
    /** Dollars, rounded up to the next $10 so the price slider ends on a round number. */
    maxPrice: Math.max(50, Math.ceil(Math.max(0, ...data.map((car) => car.daily_rate_cents)) / 1000) * 10),
  };
}

export type FilterOptions = Awaited<ReturnType<typeof filterOptions>>;
