import { KeyRound } from "lucide-react";
import { ACCESS_LABEL } from "@/lib/locations";
import type { Trip } from "@/lib/supabase/types";

type SpotTrip = Pick<Trip, "pickup_spot_kind" | "pickup_spot_name" | "delivery_address" | "vehicle_access" | "handover_note">;

/** True when the trip was booked at one of the host's named spots, like a hotel or the airport. */
export function atNamedSpot(trip: SpotTrip): boolean {
  return !!trip.pickup_spot_kind && trip.pickup_spot_kind !== "car" && trip.pickup_spot_kind !== "custom";
}

/** Directions to a named spot's address. */
export function spotDirections(trip: SpotTrip): string | null {
  const to = trip.delivery_address ?? trip.pickup_spot_name;
  return to ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(to)}` : null;
}

/**
 * The spot's address, how the key is handed over and the host's note. Guests
 * only see it once the trip is confirmed; the host always does.
 */
export function HandoverDetails({ trip, show, waitingOn }: { trip: SpotTrip; show: boolean; waitingOn?: string }) {
  const named = atNamedSpot(trip);
  if (!show) {
    return named && waitingOn ? (
      <span className="text-[15px] text-slate">The exact address and how to get the keys show here once {waitingOn} says yes.</span>
    ) : null;
  }
  if (!named && !trip.vehicle_access && !trip.handover_note) return null;
  return (
    <div className="flex flex-col gap-2">
      {named && trip.delivery_address && trip.delivery_address !== trip.pickup_spot_name && (
        <span className="text-[17px] font-semibold">{trip.delivery_address}</span>
      )}
      {(trip.vehicle_access || trip.handover_note) && (
        <div className="flex flex-col gap-1.5 rounded-[16px] bg-board px-3.5 py-3">
          {trip.vehicle_access && (
            <span className="flex items-center gap-2 text-[15px] font-bold">
              <KeyRound className="size-4" strokeWidth={2} />
              {ACCESS_LABEL[trip.vehicle_access]}
            </span>
          )}
          {trip.handover_note && <p className="text-[15px] leading-[1.45] text-slate">{trip.handover_note}</p>}
        </div>
      )}
    </div>
  );
}
