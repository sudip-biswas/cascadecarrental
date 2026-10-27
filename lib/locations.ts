import type { SupabaseClient } from "@supabase/supabase-js";
import { milesBetween } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";
import type {
  Database,
  HostLocation,
  HostLocationKind,
  HostLocationVehicle,
  PickupSpotKind,
  VehicleAccess,
} from "@/lib/supabase/types";

// Where guests get a car: the car's own spot (always free), the host's named
// spots like the airport or a hotel, or their own address inside a radius.

export const KIND_LABEL: Record<PickupSpotKind, string> = {
  car: "Car's spot",
  home: "Home",
  airport: "Airport",
  hotel: "Hotel",
  transit: "Transit",
  other: "Other",
  custom: "Custom",
};

/** Kinds a host can add as a named spot. Custom is the radius, set separately. */
export const SPOT_KINDS: Exclude<HostLocationKind, "custom">[] = ["airport", "hotel", "transit", "home", "other"];

export const ACCESS_LABEL: Record<VehicleAccess, string> = {
  lockbox: "Key in a lockbox",
  in_person: "Meet in person",
  remote_unlock: "Unlock with your phone",
};

/** A pickup choice as guests see it: no address or handover note until they book. */
export interface PickupOption {
  /** "car" for the car's own spot, else the host location's id. */
  id: string;
  kind: PickupSpotKind;
  name: string;
  fee_cents: number;
  fee_per_mi_cents: number;
  free_from_days: number | null;
  radius_mi: number | null;
  vehicle_access: VehicleAccess | null;
}

/** The same with the private details, for the server and the host. */
export interface PickupSpot extends PickupOption {
  address: string | null;
  lat: number | null;
  lng: number | null;
  handover_note: string | null;
}

export const CAR_SPOT = "car";

export type LocationWithCars = HostLocation & { host_location_vehicles: Pick<HostLocationVehicle, "vehicle_id" | "fee_cents">[] };

interface CarPlace {
  id: string;
  location_name: string;
  location_address?: string | null;
  location_lat: number;
  location_lng: number;
}

/** Whether a host location is offered on a car, and at what price. */
export function spotFor(location: LocationWithCars, vehicleId: string): { on: boolean; fee_cents: number } {
  const link = location.host_location_vehicles.find((l) => l.vehicle_id === vehicleId);
  return { on: location.all_vehicles || !!link, fee_cents: link?.fee_cents ?? location.fee_cents };
}

const ORDER: PickupSpotKind[] = ["car", "home", "airport", "hotel", "transit", "other", "custom"];

/** Every way to get this car, the car's own spot first and the custom radius last. */
export function spotsForCar(car: CarPlace, locations: LocationWithCars[]): PickupSpot[] {
  const own: PickupSpot = {
    id: CAR_SPOT,
    kind: "car",
    name: car.location_name,
    fee_cents: 0,
    fee_per_mi_cents: 0,
    free_from_days: null,
    radius_mi: null,
    vehicle_access: null,
    address: car.location_address ?? null,
    lat: car.location_lat,
    lng: car.location_lng,
    handover_note: null,
  };
  const named = locations
    .filter((l) => l.enabled && spotFor(l, car.id).on)
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.position - b.position || a.name.localeCompare(b.name))
    .map(
      (l): PickupSpot => ({
        id: l.id,
        kind: l.kind,
        name: l.name,
        fee_cents: spotFor(l, car.id).fee_cents,
        fee_per_mi_cents: l.kind === "custom" ? l.fee_per_mi_cents : 0,
        free_from_days: l.free_from_days,
        radius_mi: l.radius_mi,
        vehicle_access: l.vehicle_access,
        address: l.address,
        lat: l.lat,
        lng: l.lng,
        handover_note: l.handover_note,
      })
    );
  return [own, ...named];
}

/** Reads a host's locations. Pass the admin client: guests can't read them directly. */
export async function loadLocations(client: SupabaseClient<Database>, hostId: string): Promise<LocationWithCars[]> {
  const { data } = await client
    .from("host_locations")
    .select("*, host_location_vehicles(vehicle_id, fee_cents)")
    .eq("host_id", hostId)
    .order("position")
    .order("created_at")
    .overrideTypes<LocationWithCars[], { merge: false }>();
  return data ?? [];
}

/** A car's pickup spots, with the private details. Pass the admin client. */
export async function loadPickupSpots(
  client: SupabaseClient<Database>,
  car: CarPlace & { host_id: string }
): Promise<PickupSpot[]> {
  return spotsForCar(car, await loadLocations(client, car.host_id));
}

/** Strips the address and handover note, for the guest's browser. */
export function publicOption(spot: PickupSpot): PickupOption {
  return {
    id: spot.id,
    kind: spot.kind,
    name: spot.name,
    fee_cents: spot.fee_cents,
    fee_per_mi_cents: spot.fee_per_mi_cents,
    free_from_days: spot.free_from_days,
    radius_mi: spot.radius_mi,
    vehicle_access: spot.vehicle_access,
  };
}

export function isFreeFor(option: Pick<PickupOption, "free_from_days">, days: number): boolean {
  return option.free_from_days != null && days >= option.free_from_days;
}

/** What getting the car at this spot costs for a trip this long. */
export function spotFeeCents(option: PickupOption, days: number, miles = 0): number {
  if (option.kind === "car" || isFreeFor(option, days)) return 0;
  return option.fee_cents + Math.round(miles * option.fee_per_mi_cents);
}

/** "$40", "$10 + $1.50/mi" or "Free", ignoring trip length. */
export function feeLabel(option: Pick<PickupOption, "kind" | "fee_cents" | "fee_per_mi_cents">): string {
  if (option.kind === "car" || (option.fee_cents === 0 && option.fee_per_mi_cents === 0)) return "Free";
  if (option.fee_per_mi_cents > 0) return `${formatPrice(option.fee_cents)} + ${formatPrice(option.fee_per_mi_cents)}/mi`;
  return formatPrice(option.fee_cents);
}

/** "Free for 6+ day trips", or null. */
export function freeRule(option: Pick<PickupOption, "free_from_days">): string | null {
  return option.free_from_days ? `Free for ${option.free_from_days}+ day trips` : null;
}

/** What the guest picked: a spot, plus the address when it's the custom radius. */
export interface PickupChoice {
  spot: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export type PickupQuote<T extends PickupOption = PickupOption> =
  | { ok: true; cents: number; spot: T; miles: number | null }
  | { ok: false; reason: string };

/**
 * Prices the guest's choice from the car's spots. The page and /api/checkout
 * both run this, so the guest sees what the server charges.
 */
export function quotePickup<T extends PickupOption>(
  car: { location_lat: number; location_lng: number },
  spots: T[],
  choice: PickupChoice,
  days: number
): PickupQuote<T> {
  const spot = spots.find((s) => s.id === choice.spot);
  if (!spot) return { ok: false, reason: "That spot isn't offered any more. Pick another." };
  if (spot.kind !== "custom") return { ok: true, cents: spotFeeCents(spot, days), spot, miles: null };
  if (choice.lat == null || choice.lng == null || !choice.address) {
    return { ok: false, reason: "Pick a delivery address, or another spot." };
  }
  const miles = milesBetween({ lat: car.location_lat, lng: car.location_lng }, { lat: choice.lat, lng: choice.lng });
  if (spot.radius_mi != null && miles > spot.radius_mi) {
    return {
      ok: false,
      reason: `That's ${Math.round(miles * 10) / 10} mi from the car. This host delivers up to ${spot.radius_mi} mi.`,
    };
  }
  return { ok: true, cents: spotFeeCents(spot, days, miles), spot, miles };
}
