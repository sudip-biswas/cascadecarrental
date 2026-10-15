import type { Metadata } from "next";
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
import { FILTER_KEYS, hasFilters, parseSearchParams, type SearchFilters } from "@/components/search/params";
import { listedCars } from "@/components/search/listings";
import { tripTotalCents } from "@/components/search/vehicle";
import { formatRange, pluralize, zonedInstant } from "@/lib/utils";

export const instant = false;

// Filtered and dated views are endless, so search stays out of the index and
// the Seattle pages are the ones that rank. Crawlers still follow its links.
export const metadata: Metadata = {
  title: "Find a car",
  robots: { index: false, follow: true },
};

async function loadCars(filters: SearchFilters) {
  let cars = await listedCars(await createClient(), filters);
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
  const place = filters.where ? ` near ${filters.where}` : filters.nearSea ? " near SEA" : " in Seattle";
  const when = filters.dates
    ? `, ${formatRange(zonedInstant(filters.dates.from), zonedInstant(filters.dates.until))}`
    : "";
  return `${pluralize(count, "car")} for rent${place}${when}`;
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
