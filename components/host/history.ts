import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { hostEarningsCents } from "@/lib/pricing";
import { tripStatus } from "@/lib/trip-status";
import { toDateKey } from "@/lib/utils";
import { hostReviewDaysLeft } from "@/components/trip-panels/review/window";
import { loadHostTrips, type HostTrip } from "./data";

export interface HistoryFilter {
  car?: string;
  year?: string;
}

export interface HistoryRow {
  trip: HostTrip;
  status: ReturnType<typeof tripStatus>;
  earnedCents: number;
  rating: number | null;
  /** Days the host has left to rate the guest, 0 once rated or closed. */
  daysToRate: number;
}

/** Finished and cancelled trips, newest first, with what each one earned the host. */
export async function loadHistory(supabase: SupabaseClient<Database>, hostId: string, filter: HistoryFilter) {
  const all = (await loadHostTrips(supabase, hostId, ["completed", "cancelled_guest", "cancelled_host"])).reverse();

  const cars = new Map<string, string>();
  const years = new Set<string>();
  for (const t of all) {
    if (t.vehicle) cars.set(t.vehicle.id, `${t.vehicle.make} ${t.vehicle.model}`);
    years.add(toDateKey(t.starts_at).slice(0, 4));
  }

  const trips = all.filter(
    (t) =>
      (!filter.car || t.vehicle_id === filter.car) &&
      (!filter.year || toDateKey(t.starts_at).startsWith(filter.year))
  );

  const { data: reviews } = trips.length
    ? await supabase
        .from("reviews")
        .select("trip_id, rating_overall, kind")
        .in("trip_id", trips.map((t) => t.id))
    : { data: [] };
  const ratingByTrip = new Map(
    (reviews ?? []).filter((r) => r.kind === "guest_to_host").map((r) => [r.trip_id, r.rating_overall])
  );
  const ratedGuest = new Set((reviews ?? []).filter((r) => r.kind === "host_to_guest").map((r) => r.trip_id));

  const rows: HistoryRow[] = trips.map((trip) => ({
    trip,
    status: tripStatus(trip, "host"),
    earnedCents:
      trip.status === "completed" && trip.payment_status === "captured" ? hostEarningsCents(trip.subtotal_cents) : 0,
    rating: ratingByTrip.get(trip.id) ?? null,
    daysToRate: trip.status === "completed" && !ratedGuest.has(trip.id) ? hostReviewDaysLeft(trip) : 0,
  }));

  return {
    rows,
    cars: [...cars.entries()].map(([id, name]) => ({ id, name })),
    years: [...years].sort().reverse(),
  };
}
