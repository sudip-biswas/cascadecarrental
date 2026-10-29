import type { DueState } from "@/lib/safety";
import type { Vehicle, VehicleImage } from "@/lib/supabase/types";
import { formatDateShort, formatRange } from "@/lib/utils";
import type { Tone } from "@/components/kit";

export type TripState = "on_trip" | "booked" | "idle";
export type ListingFilter = "listed" | "unlisted";
export type ListingsView = "grid" | "list";

export const TRIP_STATES: { value: TripState; label: string }[] = [
  { value: "on_trip", label: "On a trip" },
  { value: "booked", label: "Booked" },
  { value: "idle", label: "Not booked" },
];

export const LISTING_STATES: { value: ListingFilter; label: string }[] = [
  { value: "listed", label: "Listed" },
  { value: "unlisted", label: "Unlisted" },
];

export interface ListingsQuery {
  q: string;
  trip: TripState | null;
  listing: ListingFilter | null;
  view: ListingsView;
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function readQuery(params: Record<string, string | string[] | undefined>): ListingsQuery {
  const trip = one(params.trip);
  const listing = one(params.listing);
  return {
    q: one(params.q).trim().slice(0, 60),
    trip: TRIP_STATES.some((s) => s.value === trip) ? (trip as TripState) : null,
    listing: LISTING_STATES.some((s) => s.value === listing) ? (listing as ListingFilter) : null,
    view: one(params.view) === "list" ? "list" : "grid",
  };
}

/** The listings URL with some of the query changed. Defaults stay out of it. */
export function listingsHref(query: ListingsQuery, change: Partial<ListingsQuery> = {}) {
  const next = { ...query, ...change };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.trip) params.set("trip", next.trip);
  if (next.listing) params.set("listing", next.listing);
  if (next.view === "list") params.set("view", "list");
  const qs = params.toString();
  return qs ? `/host/vehicles?${qs}` : "/host/vehicles";
}

export type TripSpan = { starts_at: string; ends_at: string };

export type Listing = Pick<
  Vehicle,
  "id" | "make" | "model" | "year" | "trim" | "license_plate" | "location_name" | "daily_rate_cents" | "status" | "rating_avg" | "trip_count"
> & {
  vehicle_images: Pick<VehicleImage, "url" | "is_cover" | "position">[];
  state: TripState;
  current: TripSpan | null;
  next: TripSpan | null;
  last: TripSpan | null;
  /** Where the yearly inspection stands. */
  inspection: DueState;
};

export function matches(car: Listing, query: ListingsQuery) {
  if (query.trip && car.state !== query.trip) return false;
  if (query.listing === "listed" && car.status !== "listed") return false;
  if (query.listing === "unlisted" && car.status === "listed") return false;
  if (!query.q) return true;
  const hay = `${car.year} ${car.make} ${car.model} ${car.trim ?? ""} ${car.license_plate}`.toLowerCase();
  const plain = (s: string) => s.replace(/[\s-]/g, "");
  return query.q
    .toLowerCase()
    .split(/\s+/)
    .every((word) => hay.includes(word) || plain(car.license_plate.toLowerCase()).includes(plain(word)));
}

/** Where the car stands now: out on a trip, booked for a later one, or free. */
export function tripLine(car: Listing): { label: string; value: string; tone: Tone } {
  if (car.current) return { label: "On a trip", value: `Back ${formatDateShort(car.current.ends_at)}`, tone: "sky" };
  if (car.next) return { label: "Next trip", value: formatRange(car.next.starts_at, car.next.ends_at), tone: "mint" };
  return { label: "Next trip", value: "Nothing booked", tone: "board" };
}

/** "Last trip: Sep 24 – Oct 3" */
export function lastTrip(car: Listing) {
  return car.last ? `Last trip: ${formatRange(car.last.starts_at, car.last.ends_at)}` : "No trips yet";
}

/** "LE · ABC1234" */
export function trimAndPlate(car: Pick<Listing, "trim" | "license_plate">) {
  return [car.trim, car.license_plate].filter(Boolean).join(" · ");
}
