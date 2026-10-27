import { BedDouble, CarFront, House, MapPin, Plane, Radius, TramFront, type LucideIcon } from "lucide-react";
import type { PickupSpotKind } from "@/lib/supabase/types";

/** One icon per kind of spot, used on the host's table and the trip pages. */
export const KIND_ICON: Record<PickupSpotKind, LucideIcon> = {
  car: CarFront,
  home: House,
  airport: Plane,
  hotel: BedDouble,
  transit: TramFront,
  other: MapPin,
  custom: Radius,
};
