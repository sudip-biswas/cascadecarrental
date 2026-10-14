import { createAdminClient } from "@/lib/supabase/admin";
import { holdsDates } from "@/lib/trips";
import { zonedInstant } from "@/lib/utils";
import { daysBetween, type DateKey } from "./dates";
import type { ListedVehicle } from "./vehicle";

/**
 * Keeps the cars that can actually be booked for these dates: not booked or
 * blocked, inside the host's trip length limits and notice window.
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
      hoursAhead >= v.advance_notice_hours
  );
  if (!bookable.length) return [];

  // Other guests' trips are hidden by row security, so this check uses the service role.
  const admin = createAdminClient();
  const ids = bookable.map((v) => v.id);
  const [trips, blocks] = await Promise.all([
    admin
      .from("trips")
      .select("vehicle_id")
      .in("vehicle_id", ids)
      .not("status", "in", '("cancelled_guest","cancelled_host")')
      .or(holdsDates())
      .lt("starts_at", end.toISOString())
      .gt("ends_at", start.toISOString()),
    admin
      .from("vehicle_availability")
      .select("vehicle_id")
      .in("vehicle_id", ids)
      .lt("blocked_from", end.toISOString())
      .gt("blocked_to", start.toISOString()),
  ]);
  const taken = new Set([...(trips.data ?? []), ...(blocks.data ?? [])].map((row) => row.vehicle_id));
  return bookable.filter((v) => !taken.has(v.id));
}
