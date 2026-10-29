import { createAdminClient } from "@/lib/supabase/admin";
import { dueState, inspectionDueOn } from "@/lib/safety";
import { toDateKey } from "@/lib/utils";
import type { Listing, TripSpan, TripState } from "./query";

type TripRow = TripSpan & { vehicle_id: string; status: string };

/**
 * The host's cars with where each one stands: on a trip now, booked for a
 * later one, or free. Plates are private columns, so this reads with the
 * service role, scoped to the host.
 */
export async function loadListings(hostId: string): Promise<Listing[]> {
  const admin = createAdminClient();
  const [{ data: cars }, { data: trips }, { data: inspections }] = await Promise.all([
    admin
      .from("vehicles")
      .select(
        "id, make, model, year, trim, license_plate, location_name, daily_rate_cents, status, rating_avg, trip_count, created_at, vehicle_images(url, is_cover, position)"
      )
      .eq("host_id", hostId)
      .order("created_at", { ascending: true }),
    admin
      .from("trips")
      .select("vehicle_id, status, starts_at, ends_at")
      .eq("host_id", hostId)
      .in("status", ["approved", "active", "completed"])
      .order("starts_at", { ascending: true }),
    admin
      .from("vehicle_inspections")
      .select("vehicle_id, inspected_on, passed, vehicles!inner(host_id)")
      .eq("vehicles.host_id", hostId)
      .eq("passed", true),
  ]);

  const now = Date.now();
  const byCar = new Map<string, TripRow[]>();
  for (const t of (trips ?? []) as TripRow[]) {
    const list = byCar.get(t.vehicle_id) ?? [];
    list.push(t);
    byCar.set(t.vehicle_id, list);
  }

  const passed = new Map<string, { inspected_on: string; passed: boolean }[]>();
  for (const i of inspections ?? []) passed.set(i.vehicle_id, [...(passed.get(i.vehicle_id) ?? []), i]);
  const today = toDateKey(new Date());

  type CarRow = Omit<Listing, "state" | "current" | "next" | "last" | "inspection"> & { created_at: string };
  return ((cars ?? []) as unknown as CarRow[]).map(({ created_at, ...car }) => {
    const list = byCar.get(car.id) ?? [];
    const live = list.filter((t) => t.status !== "completed");
    const current =
      live.find((t) => t.status === "active" || (new Date(t.starts_at).getTime() <= now && new Date(t.ends_at).getTime() > now)) ??
      null;
    const next = live.find((t) => t.status === "approved" && new Date(t.starts_at).getTime() > now) ?? null;
    const last =
      list
        .filter((t) => t.status === "completed" || (t !== current && new Date(t.ends_at).getTime() <= now))
        .at(-1) ?? null;
    const state: TripState = current ? "on_trip" : next ? "booked" : "idle";
    const inspection = dueState(inspectionDueOn(toDateKey(created_at), passed.get(car.id) ?? []), today);
    return { ...car, state, current, next, last, inspection };
  });
}
