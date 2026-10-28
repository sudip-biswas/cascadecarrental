import { createAdminClient } from "@/lib/supabase/admin";
import { holdsDates } from "@/lib/trips";
import { milesBetween } from "@/lib/pricing";
import { toDateKey } from "@/lib/utils";
import { addDays, daysBetween } from "@/components/host/days";
import {
  AUTO_HORIZON_DAYS,
  MIN_NEARBY_CARS,
  NEARBY_MILES,
  autoPriceFor,
  type AutoPrice,
  type AutoPricedCar,
  type PricingEvent,
} from "@/lib/auto-pricing";

type Car = AutoPricedCar & { id: string; location_lat: number; location_lng: number };

const CAR_COLUMNS = "id, daily_rate_cents, auto_price_min_cents, auto_price_max_cents, location_lat, location_lng";

/** What the rules need beyond the car: events, and which cars around it are booked when. */
async function loadContext(cars: Car[], from: string, to: string) {
  const admin = createAdminClient();
  const [{ data: events }, { data: listed }] = await Promise.all([
    admin.from("pricing_events").select("name, starts_on, ends_on, pct").lte("starts_on", to).gte("ends_on", from),
    admin.from("vehicles").select("id, location_lat, location_lng").eq("status", "listed"),
  ]);

  const nearby = new Map<string, string[]>();
  for (const car of cars) {
    nearby.set(
      car.id,
      (listed ?? [])
        .filter((other) => other.id === car.id || milesBetween({ lat: car.location_lat, lng: car.location_lng }, { lat: other.location_lat, lng: other.location_lng }) <= NEARBY_MILES)
        .map((other) => other.id)
    );
  }
  const market = [...new Set([...nearby.values()].flat())];

  // Each car's booked days. PostgREST pages at 1,000 rows.
  const booked = new Map<string, Set<string>>();
  for (let page = 0; market.length; page++) {
    const { data, error } = await admin
      .from("trips")
      .select("vehicle_id, starts_at, ends_at")
      .in("vehicle_id", market)
      .not("status", "in", '("cancelled_guest","cancelled_host","completed")')
      .or(holdsDates())
      .lt("starts_at", `${addDays(to, 1)}T12:00:00Z`)
      .gt("ends_at", `${from}T00:00:00Z`)
      .order("id")
      .range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    for (const trip of data) {
      const days = booked.get(trip.vehicle_id) ?? new Set<string>();
      const start = toDateKey(trip.starts_at);
      const nights = Math.max(1, daysBetween(start, toDateKey(trip.ends_at)));
      for (let i = 0; i < nights; i++) days.add(addDays(start, i));
      booked.set(trip.vehicle_id, days);
    }
    if (data.length < 1000) break;
  }

  return {
    events: (events ?? []) as PricingEvent[],
    bookedShare(carId: string, dateKey: string): number | null {
      const ids = nearby.get(carId) ?? [];
      if (ids.length < MIN_NEARBY_CARS) return null;
      return ids.filter((id) => booked.get(id)?.has(dateKey)).length / ids.length;
    },
  };
}

/** Automatic prices for each of a car's next days, with the reasons. For the host's preview. */
export async function previewAutoPrices(car: Car, days = 14): Promise<{ date: string; price: AutoPrice }[]> {
  const today = toDateKey(new Date());
  const to = addDays(today, days - 1);
  const ctx = await loadContext([car], today, to);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i);
    return { date, price: autoPriceFor(car, date, { today, events: ctx.events, bookedShare: ctx.bookedShare(car.id, date) }) };
  });
}

/**
 * Writes automatic prices for the next AUTO_HORIZON_DAYS on every car with automatic
 * pricing on, or just the ones given. Days the host priced stay as they are.
 */
export async function refreshAutoPrices(vehicleIds?: string[]): Promise<{ cars: number; days: number }> {
  const admin = createAdminClient();
  let query = admin.from("vehicles").select(CAR_COLUMNS).eq("auto_pricing", true);
  if (vehicleIds) query = query.in("id", vehicleIds);
  const { data: cars, error } = await query;
  if (error) throw error;
  if (!cars.length) return { cars: 0, days: 0 };

  const today = toDateKey(new Date());
  const to = addDays(today, AUTO_HORIZON_DAYS - 1);
  const ctx = await loadContext(cars, today, to);

  const rows = cars.flatMap((car) =>
    Array.from({ length: AUTO_HORIZON_DAYS }, (_, i) => {
      const date = addDays(today, i);
      const { cents } = autoPriceFor(car, date, { today, events: ctx.events, bookedShare: ctx.bookedShare(car.id, date) });
      return { vehicle_id: car.id, date, price_cents: cents };
    })
  );

  let days = 0;
  for (let i = 0; i < rows.length; i += 2000) {
    const { data, error: writeError } = await admin.rpc("upsert_auto_prices", { rows: rows.slice(i, i + 2000) });
    if (writeError) throw writeError;
    days += data ?? 0;
  }
  return { cars: cars.length, days };
}

/** Takes a car's automatic prices off its coming days, back to the daily rate. */
export async function clearAutoPrices(vehicleId: string) {
  const { error } = await createAdminClient()
    .from("vehicle_daily_prices")
    .delete()
    .eq("vehicle_id", vehicleId)
    .eq("source", "auto")
    .gte("date", toDateKey(new Date()));
  if (error) throw error;
}
