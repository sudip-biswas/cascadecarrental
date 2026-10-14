import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Trip, Vehicle } from "@/lib/supabase/types";
import { isAbandoned } from "@/lib/trip-status";
import type { Occupant } from "./days";

type Client = SupabaseClient<Database>;

export type HostTrip = Pick<
  Trip,
  | "id"
  | "vehicle_id"
  | "guest_id"
  | "starts_at"
  | "ends_at"
  | "status"
  | "payment_status"
  | "subtotal_cents"
  | "total_cents"
  | "distance_included_mi"
  | "protection_plan"
  | "cancellation_reason"
  | "created_at"
> & {
  guest: {
    id: string;
    full_name: string;
    created_at: string;
    identity_verified: boolean;
    driving_license_verified: boolean;
  } | null;
  vehicle: Pick<Vehicle, "id" | "make" | "model" | "year"> | null;
};

const TRIP_SELECT =
  "id, vehicle_id, guest_id, starts_at, ends_at, status, payment_status, subtotal_cents, total_cents, distance_included_mi, protection_plan, cancellation_reason, created_at, guest:profiles!guest_id(id, full_name, created_at, identity_verified, driving_license_verified), vehicle:vehicles(id, make, model, year)";

/** A host's trips, oldest pick-up first, without checkouts nobody finished. */
export async function loadHostTrips(
  supabase: Client,
  hostId: string,
  statuses: Trip["status"][]
): Promise<HostTrip[]> {
  const { data } = await supabase
    .from("trips")
    .select(TRIP_SELECT)
    .eq("host_id", hostId)
    .in("status", statuses)
    .order("starts_at", { ascending: true });
  return ((data ?? []) as unknown as HostTrip[]).filter((t) => !isAbandoned(t));
}

export function isRequest(trip: Pick<Trip, "status" | "payment_status">) {
  return trip.status === "pending" && trip.payment_status === "authorized";
}

export interface ConversationLink {
  id: string;
  lastGuestMessage: string | null;
}

type ConversationRow = {
  id: string;
  guest_id: string;
  trip_id: string | null;
  messages: { body: string; sender_id: string; created_at: string }[];
};

/** Finds the conversation to open for a trip: the trip's own, or any with that guest. */
export async function loadConversationFinder(supabase: Client, hostId: string) {
  const { data } = await supabase
    .from("conversations")
    .select("id, guest_id, trip_id, messages(body, sender_id, created_at)")
    .eq("host_id", hostId);
  const rows = (data ?? []) as unknown as ConversationRow[];

  return (trip: Pick<Trip, "id" | "guest_id">): ConversationLink | null => {
    const conv =
      rows.find((c) => c.trip_id === trip.id) ?? rows.find((c) => c.guest_id === trip.guest_id);
    if (!conv) return null;
    const last = conv.messages
      .filter((m) => m.sender_id === trip.guest_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return { id: conv.id, lastGuestMessage: last?.body ?? null };
  };
}

/** Holds lapse after about a week, and requests close at pick-up, whichever comes first. */
export function answerBy(trip: Pick<Trip, "starts_at" | "created_at">): Date {
  const holdEnds = new Date(new Date(trip.created_at).getTime() + 7 * 86_400_000);
  const pickup = new Date(trip.starts_at);
  return holdEnds < pickup ? holdEnds : pickup;
}

/** "5 h left" or "2 days left". */
export function timeLeft(deadline: Date, now = new Date()): string {
  const hours = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 3_600_000));
  if (hours < 48) return `${hours} h left`;
  return `${Math.floor(hours / 24)} days left`;
}

export const PROTECTION_LABEL: Record<string, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
};

export type BlockRow = Pick<
  Database["public"]["Tables"]["vehicle_availability"]["Row"],
  "id" | "vehicle_id" | "blocked_from" | "blocked_to" | "reason"
>;

/** Trips and blocks for one car, ready to draw on a calendar. */
export function occupantsFor(vehicleId: string, trips: HostTrip[], blocks: BlockRow[]): Occupant[] {
  const fromTrips: Occupant[] = trips
    .filter((t) => t.vehicle_id === vehicleId && (isRequest(t) || ["approved", "active", "completed"].includes(t.status)))
    .map((t) => {
      const name = t.guest?.full_name?.trim().split(/\s+/)[0] || "Guest";
      const request = isRequest(t);
      return {
        id: t.id,
        kind: request ? "request" : "booked",
        label: request ? `${name} · request` : name,
        start: t.starts_at,
        end: t.ends_at,
      };
    });
  const fromBlocks: Occupant[] = blocks
    .filter((b) => b.vehicle_id === vehicleId)
    .map((b) => ({
      id: b.id,
      kind: "blocked",
      label: b.reason?.trim() || "Blocked",
      start: b.blocked_from,
      end: b.blocked_to,
    }));
  return [...fromTrips, ...fromBlocks];
}
