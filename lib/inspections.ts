import { createAdminClient } from "@/lib/supabase/admin";
import type { Trip, TripInspection } from "@/lib/supabase/types";
import { tripDays } from "@/lib/pricing";

export type InspectionKind = TripInspection["kind"];
export type InspectionRole = TripInspection["role"];

export const INSPECTION_BUCKET = "trip-photos";
export const INSPECTION_LIMITS = {
  photosMax: 12,
  photoMaxBytes: 10 * 1024 * 1024,
  notesMax: 2000,
} as const;

/** Check-in opens this long before pick-up, and check-out stays open this long after the trip. */
const WINDOW_MS = 24 * 60 * 60 * 1000;

/** How long a photo link works. Long enough to look through a trip page. */
const SIGNED_URL_SECONDS = 60 * 60;

type WindowTrip = Pick<Trip, "status" | "starts_at" | "ends_at" | "completed_at">;

/** Last moment a check-out can be sent once the trip is over. */
function returnClosesAt(trip: WindowTrip) {
  const end = Math.max(new Date(trip.ends_at).getTime(), trip.completed_at ? new Date(trip.completed_at).getTime() : 0);
  return new Date(end + WINDOW_MS);
}

/** When this side of the trip can first be recorded. */
export function inspectionOpensAt(trip: WindowTrip, kind: InspectionKind) {
  const start = new Date(trip.starts_at).getTime();
  return new Date(kind === "pickup" ? start - WINDOW_MS : start);
}

/**
 * Whether a check-in or check-out can be sent now. Check-in: from 24 hours
 * before pick-up while the trip is on. Check-out: once the trip has started,
 * and up to 24 hours after it ends.
 */
export function inspectionOpen(trip: WindowTrip, kind: InspectionKind, now = new Date()) {
  const opened = now >= inspectionOpensAt(trip, kind);
  if (kind === "pickup") return opened && (trip.status === "approved" || trip.status === "active");
  if (trip.status === "approved" || trip.status === "active") return opened;
  return trip.status === "completed" && now <= returnClosesAt(trip);
}

export interface MilesSummary {
  pickupMi: number;
  returnMi: number;
  driven: number;
  /** Null when the trip has unlimited miles. */
  includedMi: number | null;
  overMi: number;
  /** What the extra miles cost at the trip's per-mile fee. */
  overCents: number;
}

/** Miles driven against the allowance. Null until both readings are in, or when they don't add up. */
export function milesSummary(input: {
  pickupMi: number | null;
  returnMi: number | null;
  distanceIncludedMi: number;
  days: number;
  unlimited: boolean;
  extraMileFeeCents: number;
}): MilesSummary | null {
  const { pickupMi, returnMi } = input;
  if (pickupMi == null || returnMi == null || returnMi < pickupMi) return null;
  const driven = returnMi - pickupMi;
  const includedMi = input.unlimited ? null : input.distanceIncludedMi * input.days;
  const overMi = includedMi == null ? 0 : Math.max(0, driven - includedMi);
  return { pickupMi, returnMi, driven, includedMi, overMi, overCents: overMi * input.extraMileFeeCents };
}

type Reading = Pick<TripInspection, "kind" | "role" | "odometer_mi">;

/**
 * The two odometer readings to compare. One person's pair beats a mix, so a
 * guest's own check-in and check-out are used together when both are in,
 * then the host's, then whatever there is.
 */
export function odometerPair(rows: Reading[]) {
  const reading = (kind: InspectionKind, role?: InspectionRole) =>
    rows.find((r) => r.kind === kind && r.odometer_mi != null && (!role || r.role === role))?.odometer_mi ?? null;
  for (const role of ["guest", "host"] as const) {
    const pickupMi = reading("pickup", role);
    const returnMi = reading("return", role);
    if (pickupMi != null && returnMi != null) return { pickupMi, returnMi };
  }
  return { pickupMi: reading("pickup"), returnMi: reading("return") };
}

type MilesTrip = Pick<Trip, "starts_at" | "ends_at" | "distance_included_mi" | "unlimited_miles" | "extra_mile_fee_cents">;

export function tripMiles(trip: MilesTrip, rows: Reading[]) {
  return milesSummary({
    ...odometerPair(rows),
    distanceIncludedMi: trip.distance_included_mi,
    days: tripDays(trip.starts_at, trip.ends_at),
    unlimited: trip.unlimited_miles,
    extraMileFeeCents: trip.extra_mile_fee_cents,
  });
}

/** Miles driven on a trip from its check-in and check-out readings, for extra-mile charges. */
export async function milesDriven(tripId: string) {
  const admin = createAdminClient();
  const [{ data: trip }, { data: rows }] = await Promise.all([
    admin
      .from("trips")
      .select("starts_at, ends_at, distance_included_mi, unlimited_miles, extra_mile_fee_cents")
      .eq("id", tripId)
      .maybeSingle(),
    admin.from("trip_inspections").select("kind, role, odometer_mi").eq("trip_id", tripId),
  ]);
  if (!trip) return null;
  return tripMiles(trip, rows ?? []);
}

export type InspectionWithPhotos = TripInspection & { photoUrls: { path: string; url: string | null }[] };

/** A trip's inspections with short-lived links to their photos. Only call after checking the viewer is on the trip. */
export async function loadInspections(tripId: string): Promise<InspectionWithPhotos[]> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("trip_inspections")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at");
  if (!rows?.length) return [];

  const paths = rows.flatMap((r) => r.photos);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await admin.storage.from(INSPECTION_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }
  return rows.map((r) => ({ ...r, photoUrls: r.photos.map((path) => ({ path, url: urls.get(path) ?? null })) }));
}
