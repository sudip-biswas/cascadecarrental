import { createAdminClient } from "@/lib/supabase/admin";
import { holdsDates } from "@/lib/trips";
import { zonedInstant } from "@/lib/utils";
import { startsOnWeekend } from "@/lib/trip-rules";
import { daysBetween, type DateKey } from "./dates";
import type { ListedVehicle } from "./vehicle";

/**
 * Keeps the cars that can actually be booked for these dates: not booked or
 * blocked, with room for the host's time between trips, inside their trip length
 * limits, weekend minimum and notice window. Each car comes back with its day
 * prices for the dates, so its card shows what checkout will charge.
 */
export async function availableFor(vehicles: ListedVehicle[], from: DateKey, until: DateKey) {
  const start = zonedInstant(from);
  const end = zonedInstant(until);
  const days = daysBetween(from, until);
  const hoursAhead = (start.getTime() - Date.now()) / 3_600_000;

  const bookable = vehicles.filter(
    (v) =>
      days >= v.min_trip_days &&
      (!v.max_trip_days || days <= v.max_trip_days) &&
      hoursAhead >= v.advance_notice_hours &&
      !(v.weekend_min_two_days && days < 2 && startsOnWeekend(from))
  );
  if (!bookable.length) return [];

  // Other guests' trips are hidden by row security, so this check uses the service role.
  const admin = createAdminClient();
  const ids = bookable.map((v) => v.id);
  // Trips are fetched as far out as the longest buffer reaches, then checked per car.
  const reach = Math.max(0, ...bookable.map((v) => v.trip_buffer_hours)) * 3_600_000;
  const [trips, blocks, prices] = await Promise.all([
    admin
      .from("trips")
      .select("vehicle_id, starts_at, ends_at")
      .in("vehicle_id", ids)
      .not("status", "in", '("cancelled_guest","cancelled_host")')
      .or(holdsDates())
      .lt("starts_at", new Date(end.getTime() + reach).toISOString())
      .gt("ends_at", new Date(start.getTime() - reach).toISOString()),
    admin
      .from("vehicle_availability")
      .select("vehicle_id")
      .in("vehicle_id", ids)
      .lt("blocked_from", end.toISOString())
      .gt("blocked_to", start.toISOString()),
    admin
      .from("vehicle_daily_prices")
      .select("vehicle_id, date, price_cents")
      .in("vehicle_id", ids)
      .gte("date", from)
      .lt("date", until),
  ]);
  const buffer = new Map(bookable.map((v) => [v.id, v.trip_buffer_hours * 3_600_000]));
  const taken = new Set([
    ...(trips.data ?? [])
      .filter((t) => {
        const pad = buffer.get(t.vehicle_id) ?? 0;
        return new Date(t.starts_at).getTime() < end.getTime() + pad && new Date(t.ends_at).getTime() > start.getTime() - pad;
      })
      .map((t) => t.vehicle_id),
    ...(blocks.data ?? []).map((row) => row.vehicle_id),
  ]);
  const dayPrices = new Map<string, Record<string, number>>();
  for (const row of prices.data ?? []) {
    dayPrices.set(row.vehicle_id, { ...dayPrices.get(row.vehicle_id), [row.date]: row.price_cents });
  }
  return bookable.filter((v) => !taken.has(v.id)).map((v) => ({ ...v, day_prices: dayPrices.get(v.id) ?? {} }));
}
