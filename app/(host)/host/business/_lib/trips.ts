import { createClient } from "@/lib/supabase/server";
import type { Trip } from "@/lib/supabase/types";

export type HostTripRow = Pick<
  Trip,
  | "id"
  | "vehicle_id"
  | "status"
  | "payment_status"
  | "subtotal_cents"
  | "starts_at"
  | "ends_at"
  | "created_at"
  | "cancellation_reason"
> & {
  guest: { full_name: string | null } | null;
  vehicles: { make: string; model: string } | null;
};

/** Every trip on this host's cars, newest first. */
export async function hostTrips(hostId: string): Promise<HostTripRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("trips")
    .select(
      "id, vehicle_id, status, payment_status, subtotal_cents, starts_at, ends_at, created_at, cancellation_reason, guest:profiles!guest_id(full_name), vehicles(make, model)"
    )
    .eq("host_id", hostId)
    .order("ends_at", { ascending: false })
    .overrideTypes<HostTripRow[], { merge: false }>();
  return data ?? [];
}

/** Paid and not cancelled: money the host keeps. */
export function isPaidTrip(t: Pick<Trip, "status" | "payment_status">) {
  return (
    t.payment_status === "captured" &&
    (t.status === "approved" || t.status === "active" || t.status === "completed")
  );
}

/** A request waiting on the host: the guest's card is held. */
export function isOpenRequest(t: Pick<Trip, "status" | "payment_status">) {
  return t.status === "pending" && t.payment_status === "authorized";
}
