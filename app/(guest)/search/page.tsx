import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { FilterBar } from "@/components/search/FilterBar";
import { VehicleCard } from "@/components/search/VehicleCard";
import { VehicleGridSkeleton } from "@/components/search/VehicleCardSkeleton";
import type { SearchParams, VehicleWithImages } from "@/types";

export const instant = false;

export const metadata = { title: "Search cars" };

interface PageProps {
  searchParams: Promise<SearchParams>;
}

async function SearchResults({ params }: { params: SearchParams }) {
  const supabase = await createClient();

  let query = supabase
    .from("vehicles")
    .select("*, vehicle_images(*)")
    .eq("status", "listed");

  if (params.type) {
    const types = params.type.split(",");
    query = query.in("vehicle_type", types);
  }

  if (params.fuel) {
    const fuels = params.fuel.split(",");
    query = query.in("fuel_type", fuels);
  }

  if (params.seats) {
    const seats = params.seats.split(",").map(Number).filter(Boolean);
    if (seats.length > 0) {
      query = query.gte("seats", Math.min(...seats));
    }
  }

  if (params.maxPrice) {
    const maxCents = parseInt(params.maxPrice) * 100;
    query = query.lte("daily_rate_cents", maxCents);
  }

  if (params.minPrice) {
    const minCents = parseInt(params.minPrice) * 100;
    query = query.gte("daily_rate_cents", minCents);
  }

  if (params.where) {
    query = query.ilike("location_name", `%${params.where}%`);
  }

  switch (params.sort) {
    case "price_asc":
      query = query.order("daily_rate_cents", { ascending: true });
      break;
    case "price_desc":
      query = query.order("daily_rate_cents", { ascending: false });
      break;
    case "rating":
      query = query.order("rating_avg", { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order("trip_count", { ascending: false });
  }

  const { data: vehicles, error } = await query.limit(50);

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Something went wrong loading vehicles.
      </div>
    );
  }

  if (!vehicles?.length) {
    return (
      <div className="text-center py-16 space-y-3">
        <div className="text-4xl">🔍</div>
        <h3 className="text-lg font-semibold text-cascade-900">No cars found</h3>
        <p className="text-muted-foreground text-sm">
          Try adjusting your filters or searching a different location.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground font-medium">
        {vehicles.length}+ cars available
        {params.where && (
          <span className="text-cascade-700"> near {params.where}</span>
        )}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {(vehicles as VehicleWithImages[]).map((vehicle) => (
          <VehicleCard
            key={vehicle.id}
            vehicle={vehicle}
            searchParams={{ from: params.from, until: params.until }}
          />
        ))}
      </div>
    </div>
  );
}

export default async function SearchPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Active search summary */}
      {params.where && (
        <div className="text-sm text-cascade-900">
          <span className="font-semibold">{params.where}</span>
          {params.from && (
            <span className="text-muted-foreground">
              {" "}
              · {params.from} – {params.until ?? "open end"}
            </span>
          )}
        </div>
      )}

      {/* Filters */}
      <Suspense>
        <FilterBar />
      </Suspense>

      {/* Results */}
      <Suspense fallback={<VehicleGridSkeleton />}>
        <SearchResults params={params} />
      </Suspense>
    </div>
  );
}
