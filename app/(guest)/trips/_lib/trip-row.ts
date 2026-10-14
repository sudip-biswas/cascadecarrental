import type { Trip } from "@/lib/supabase/types";

/** What the guest trip pages read for each trip. */
export const TRIP_SELECT =
  "*, vehicle:vehicles(id, make, model, year, trim, instant_book, location_name, location_lat, location_lng, distance_included_mi, vehicle_images(url, is_cover, position)), host:profiles!host_id(id, full_name)";

export type TripRow = Trip & {
  vehicle: {
    id: string;
    make: string;
    model: string;
    year: number;
    trim: string | null;
    instant_book: boolean;
    location_name: string;
    /** Private: filled in by the trip page once the host has said yes. */
    location_address?: string | null;
    location_lat: number;
    location_lng: number;
    distance_included_mi: number;
    vehicle_images: { url: string; is_cover: boolean; position: number }[];
  } | null;
  host: { id: string; full_name: string } | null;
};

export function coverOf(trip: TripRow): string | null {
  const images = [...(trip.vehicle?.vehicle_images ?? [])].sort(
    (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.position - b.position
  );
  return images[0]?.url ?? null;
}

export function carName(trip: TripRow): string {
  return trip.vehicle ? `${trip.vehicle.make} ${trip.vehicle.model}` : "Car";
}

export function hostFirstName(trip: TripRow): string {
  return trip.host?.full_name?.split(" ")[0] || "your host";
}

/** Upcoming covers anything not finished or cancelled. */
export function tripGroup(trip: Trip): "upcoming" | "past" | "cancelled" {
  if (trip.status === "cancelled_guest" || trip.status === "cancelled_host") return "cancelled";
  if (trip.status === "completed") return "past";
  return "upcoming";
}

/** Label for the money line, which depends on where the payment is. */
export function paidLabel(trip: Trip): string {
  switch (trip.payment_status) {
    case "captured":
      return "Paid";
    case "authorized":
      return "Held on card";
    case "refunded":
      return "Refunded";
    case "voided":
      return "Hold released";
    default:
      return "Total";
  }
}
