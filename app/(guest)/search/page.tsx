import { Suspense } from "react";
import Link from "next/link";
import { CalendarSearch, SearchX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Container, EmptyState, Tile } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/search/FilterBar";
import { SearchForm } from "@/components/search/SearchForm";
import { VehicleCard } from "@/components/search/VehicleCard";
import { VehicleGridSkeleton } from "@/components/search/VehicleCardSkeleton";
import { availableFor } from "@/components/search/availability";
import { SEA_BOUNDS } from "@/components/search/categories";
import { FILTER_KEYS, hasFilters, parseSearchParams, type SearchFilters } from "@/components/search/params";
import { LISTED_VEHICLE_SELECT, tripTotalCents, type ListedVehicle } from "@/components/search/vehicle";
import { formatRange, pluralize, zonedInstant } from "@/lib/utils";

export const instant = false;

export const metadata = { title: "Find a car" };

/** Enough for every car in a young marketplace; filtered further for dates below. */
const MAX_RESULTS = 200;

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function loadCars(filters: SearchFilters) {
  const supabase = await createClient();
  let query = supabase.from("vehicles").select(LISTED_VEHICLE_SELECT).eq("status", "listed");

  if (filters.types.length) query = query.in("vehicle_type", filters.types);
  if (filters.fuels.length) query = query.in("fuel_type", filters.fuels);
  if (filters.minSeats) query = query.gte("seats", filters.minSeats);
  if (filters.maxPrice) query = query.lte("daily_rate_cents", filters.maxPrice * 100);
  if (filters.instant) query = query.eq("instant_book", true);
  if (filters.weekDiscount) query = query.gt("weekly_discount_pct", 0);
  if (filters.where) query = query.ilike("location_name", `%${escapeLike(filters.where)}%`);
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

  let cars = data as unknown as ListedVehicle[];
  if (filters.dates) {
    const { from, until } = filters.dates;
    cars = await availableFor(cars, from, until);
    // Long-trip discounts can reorder cars, so sort by what the guest will pay.
    if (filters.sort === "price") {
      cars.sort((a, b) => tripTotalCents(a, from, until) - tripTotalCents(b, from, until));
    }
  }
  return cars;
}

function heading(count: number, filters: SearchFilters) {
  const place = filters.where ? ` near ${filters.where}` : filters.nearSea ? " near SEA" : "";
  const when = filters.dates
    ? `, ${formatRange(zonedInstant(filters.dates.from), zonedInstant(filters.dates.until))}`
    : "";
  return `${pluralize(count, "car")}${place}${when}`;
}

/** The current URL with the filters dropped, keeping where and when. */
function withoutFilters(raw: Record<string, string>) {
  const params = new URLSearchParams(raw);
  for (const key of FILTER_KEYS) params.delete(key);
  const qs = params.toString();
  return qs ? `/search?${qs}` : "/search";
}

async function Results({ filters, raw }: { filters: SearchFilters; raw: Record<string, string> }) {
  const cars = await loadCars(filters);

  if (!cars.length) {
    const filtered = hasFilters(filters);
    return (
      <EmptyState
        icon={filtered ? <SearchX /> : <CalendarSearch />}
        title={filtered ? "No cars match those filters" : filters.dates ? "Nothing free for those dates" : "No cars here yet"}
        body={
          filtered
            ? "Loosen a filter or two and there may be more."
            : filters.dates
              ? "Every car nearby is booked or the host needs more notice. Try other dates or a wider area."
              : "Cascade is new in Seattle, so there aren't many cars yet. Try a wider area."
        }
        action={
          <Button asChild>
            <Link href={filtered ? withoutFilters(raw) : "/search"}>
              {filtered ? "Clear filters" : "See every car"}
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="headline my-1 text-[30px] sm:text-[40px]">{heading(cars.length, filters)}</h1>
      <div className="grid gap-3 xl:grid-cols-2">
        {cars.map((car, i) => (
          <VehicleCard key={car.id} vehicle={car} dates={filters.dates} layout="row" priority={i < 2} />
        ))}
      </div>
      {filters.dates && (
        <Tile tone="butter" className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] py-4">
          <span className="text-[15px]">
            That&apos;s every car free for these dates. Prices include tax.
          </span>
          <Link href={filters.where ? `/search?where=${encodeURIComponent(filters.where)}` : "/search"} className="text-[15px] font-extrabold hover:text-cobalt">
            Try other dates
          </Link>
        </Tile>
      )}
    </div>
  );
}

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const raw = Object.fromEntries(
    Object.entries(await searchParams).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))
  );
  const filters = parseSearchParams(raw);
  const keep = Object.fromEntries(Object.entries(raw).filter(([k]) => FILTER_KEYS.includes(k) || k === "sort"));

  return (
    <Container className="flex flex-col gap-4 pt-5 pb-16">
      <SearchForm
        key={`${filters.where}|${filters.dates?.from}|${filters.dates?.until}`}
        where={filters.where ?? ""}
        from={filters.dates?.from}
        until={filters.dates?.until}
        keep={keep}
        size="md"
      />
      <Suspense fallback={<div className="h-11" />}>
        <FilterBar />
      </Suspense>
      <Suspense key={JSON.stringify(raw)} fallback={<VehicleGridSkeleton layout="row" count={4} />}>
        <Results filters={filters} raw={raw} />
      </Suspense>
    </Container>
  );
}
