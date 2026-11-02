import { tripDays } from "@/lib/pricing";
import type { ChargeKind } from "@/lib/supabase/types";

const DAY_MS = 86_400_000;

/** A charge the guest doesn't answer is collected after this long. */
export const AUTO_CHARGE_DAYS = 3;
/** Most charges can be sent for this long after the trip ends. */
export const CHARGE_WINDOW_DAYS = 7;
/** Tolls and tickets arrive late, so they get longer. */
export const TOLL_WINDOW_DAYS = 90;
/** A damage claim can be reported, charged or escalated for this long. */
export const CLAIM_WINDOW_DAYS = 20;
/** From this length, tolls and tickets can go during the trip, one open at a time. */
export const LONG_TRIP_DAYS = 60;

export const CHARGE_KIND_VALUES = [
  "extra_miles",
  "fuel",
  "tolls",
  "ticket",
  "cleaning",
  "smoking",
  "late_return",
  "damage",
  "other",
] as const satisfies readonly ChargeKind[];

type WindowTrip = { status: string; starts_at: string; ends_at: string };

const afterTrip = (trip: Pick<WindowTrip, "ends_at">, days: number) =>
  new Date(new Date(trip.ends_at).getTime() + days * DAY_MS);

export const isLongTrip = (trip: Pick<WindowTrip, "starts_at" | "ends_at">) =>
  tripDays(trip.starts_at, trip.ends_at) >= LONG_TRIP_DAYS;

export const isTollKind = (kind: ChargeKind) => kind === "tolls" || kind === "ticket";

/** The last moment a trip can get a claim, a claim charge or an escalation. */
export const claimClosesAt = (trip: Pick<WindowTrip, "ends_at">) => afterTrip(trip, CLAIM_WINDOW_DAYS);

export function chargeWindowDays(kind: ChargeKind, linkedToClaim = false) {
  if (isTollKind(kind)) return TOLL_WINDOW_DAYS;
  return kind === "damage" && linkedToClaim ? CLAIM_WINDOW_DAYS : CHARGE_WINDOW_DAYS;
}

/**
 * Whether the host can send this kind of charge now. After the trip each kind
 * has its own deadline. During it only tolls can go, plus tickets on long trips.
 */
export function chargeWindow(
  trip: WindowTrip,
  kind: ChargeKind,
  { linkedToClaim = false, now = new Date() }: { linkedToClaim?: boolean; now?: Date } = {}
): { open: boolean; midTrip: boolean; closesAt: Date } {
  const closesAt = afterTrip(trip, chargeWindowDays(kind, linkedToClaim));
  if (trip.status === "active") {
    return { open: kind === "tolls" || (kind === "ticket" && isLongTrip(trip)), midTrip: true, closesAt };
  }
  return { open: trip.status === "completed" && now < closesAt, midTrip: false, closesAt };
}

/** The kinds a host can send right now, for the form. A claim's charge goes through the claim. */
export function sendableKinds(trip: WindowTrip, now = new Date()): ChargeKind[] {
  return CHARGE_KIND_VALUES.filter((kind) => chargeWindow(trip, kind, { now }).open);
}
