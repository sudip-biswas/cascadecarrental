import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ageOn } from "@/lib/pricing";
import type { Database, Trip, TripDriver } from "@/lib/supabase/types";
import { toDateKey } from "@/lib/utils";

// Additional drivers: the guest adds them after booking, the host approves or
// declines each one. Shared by the trip panels and /api/trips/[tripId]/drivers.

/** Drivers on one trip besides the guest, pending or approved. */
export const MAX_DRIVERS = 4;

const DRIVER_TRIP_STATUSES: Trip["status"][] = ["pending", "approved", "active"];

/** Drivers can be added, removed and answered until the trip ends. */
export function driversOpen(trip: Pick<Trip, "status" | "ends_at">, now = new Date()): boolean {
  return DRIVER_TRIP_STATUSES.includes(trip.status) && new Date(trip.ends_at) > now;
}

export const DRIVER_STATUS: Record<TripDriver["status"], { label: string; tone: "mint" | "butter" | "peach" | "board" }> = {
  pending: { label: "Waiting on the host", tone: "butter" },
  approved: { label: "Approved to drive", tone: "mint" },
  declined: { label: "Declined", tone: "peach" },
  removed: { label: "Removed", tone: "board" },
};

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const driverInput = z.object({
  fullName: z.string().trim().min(2, "Add their full name.").max(120),
  email: z.string().trim().toLowerCase().email("Add a real email address.").max(254),
  dateOfBirth: dateKey,
  licenceLast4: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{4}$/, "Add the last 4 characters of their licence number."),
  licenceState: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "Add the 2-letter state on their licence."),
  licenceExpiry: dateKey,
});

export type DriverInput = z.infer<typeof driverInput>;

/**
 * Whether this person can drive the car on this trip: old enough for the
 * car's minimum age on pick-up day (or today, once the trip has started),
 * and a licence that's good until the car is back.
 */
export function checkDriver(
  input: Pick<DriverInput, "dateOfBirth" | "licenceExpiry">,
  trip: Pick<Trip, "starts_at" | "ends_at">,
  minAge: number,
  now = new Date()
): { ok: true; age: number } | { ok: false; message: string } {
  const today = toDateKey(now);
  if (input.dateOfBirth < "1900-01-01" || input.dateOfBirth >= today) {
    return { ok: false, message: "Add their date of birth." };
  }
  const on = new Date(Math.max(now.getTime(), new Date(trip.starts_at).getTime()));
  const age = ageOn(input.dateOfBirth, new Date(`${toDateKey(on)}T12:00:00Z`));
  if (age < minAge) {
    return { ok: false, message: `Drivers have to be ${minAge} or older for this car. They'd be ${age}.` };
  }
  if (input.licenceExpiry < toDateKey(trip.ends_at)) {
    return { ok: false, message: "Their licence has to be valid until the car is back." };
  }
  return { ok: true, age };
}

export type DriverRow = TripDriver & {
  profile: { driving_license_verified: boolean; identity_verified: boolean } | null;
};

/** The trip's drivers that still count (not removed), oldest first. */
export async function loadDrivers(client: SupabaseClient<Database>, tripId: string): Promise<DriverRow[]> {
  const { data } = await client
    .from("trip_drivers")
    .select("*, profile:profiles!profile_id(driving_license_verified, identity_verified)")
    .eq("trip_id", tripId)
    .neq("status", "removed")
    .order("created_at");
  return (data ?? []) as unknown as DriverRow[];
}

/** "Anna Heck" → "Anna". */
export function driverFirstName(name: string) {
  return name.trim().split(/\s+/)[0] || "Driver";
}
