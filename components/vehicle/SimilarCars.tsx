import { createClient } from "@/lib/supabase/server";
import { TileTitle } from "@/components/kit";
import { VehicleCard } from "@/components/search/VehicleCard";
import { withTodayPrices } from "@/components/search/prices";
import { availableFor } from "@/components/search/availability";
import { loadFavorites } from "@/components/search/favorites";
import { LISTED_VEHICLE_SELECT, type ListedVehicle } from "@/components/search/vehicle";
import type { DateKey } from "@/components/search/dates";

const SHOW = 6;

/**
 * Other listed cars like this one: the same kind first, then the closest in
 * price. With dates, only cars that are free for them.
 */
export async function SimilarCars({
  vehicleId,
  vehicleType,
  dailyRateCents,
  dates,
}: {
  vehicleId: string;
  vehicleType: string;
  dailyRateCents: number;
  dates: { from: DateKey; until: DateKey } | null;
}) {
  const supabase = await createClient();
  const [{ data }, favorites] = await Promise.all([
    supabase.from("vehicles").select(LISTED_VEHICLE_SELECT).eq("status", "listed").neq("id", vehicleId).limit(60),
    loadFavorites(supabase),
  ]);
  let cars = await withTodayPrices((data ?? []) as unknown as ListedVehicle[]);
  if (dates) cars = await availableFor(cars, dates.from, dates.until);

  const score = (car: ListedVehicle) =>
    (car.vehicle_type === vehicleType ? 0 : 1) * 1_000_000 + Math.abs(car.daily_rate_cents - dailyRateCents);
  cars = cars.sort((a, b) => score(a) - score(b)).slice(0, SHOW);
  if (!cars.length) return null;

  return (
    <section aria-labelledby="similar-cars" className="flex flex-col gap-3">
      <TileTitle id="similar-cars">{dates ? "Similar cars for your dates" : "Similar cars"}</TileTitle>
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:none]">
        {cars.map((car) => (
          <div key={car.id} className="w-[min(82vw,330px)] shrink-0 snap-start">
            <VehicleCard
              vehicle={car}
              dates={dates}
              favorite={{ userId: favorites.userId, saved: favorites.saved.has(car.id) }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
