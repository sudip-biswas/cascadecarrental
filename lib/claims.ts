import { createAdminClient } from "@/lib/supabase/admin";
import { CLAIM_WINDOW_DAYS, chargeWindow, claimClosesAt } from "@/lib/charge-windows";
import { OPEN_CHARGE_STATUSES, createCharge } from "@/lib/charges";
import { notifyTrip } from "@/lib/notify";
import type { ClaimStatus, Trip, TripClaim } from "@/lib/supabase/types";

const DAY_MS = 86_400_000;
const LATE_AFTER_MS = 86_400_000;

/** Documents for an escalated claim are due this long after escalating. */
export const DOCUMENTS_DAYS = 15;
/** Photos on one claim, across the report and any added later. */
export const CLAIM_PHOTOS_MAX = 12;

export const OPEN_CLAIM_STATUSES: ClaimStatus[] = ["reported", "with_guest", "disputed", "escalated"];

export type ClaimTrip = Pick<Trip, "id" | "host_id" | "guest_id" | "vehicle_id" | "status" | "starts_at" | "ends_at">;

export const CLAIM_TRIP_SELECT = "id, host_id, guest_id, vehicle_id, status, starts_at, ends_at";

export type ClaimResult = { ok: true } | { ok: false; error: string; status: number };

const refuse = (error: string, status = 409): ClaimResult => ({ ok: false, error, status });

export const isOpenClaim = (claim: Pick<TripClaim, "status">) => OPEN_CLAIM_STATUSES.includes(claim.status);

/** Reports open when the trip starts and close 20 days after it ends. */
export function claimWindow(trip: Pick<Trip, "status" | "ends_at">, now = new Date()) {
  const closesAt = claimClosesAt(trip);
  return { open: trip.status === "active" || (trip.status === "completed" && now < closesAt), closesAt };
}

/** Hosts have 24 hours from the end of the trip, guests 24 hours from the incident. */
export function isLateReport(
  reportedBy: TripClaim["reported_by"],
  trip: Pick<Trip, "ends_at">,
  incidentAt: Date,
  now = new Date()
) {
  const from = reportedBy === "host" ? new Date(trip.ends_at) : incidentAt;
  return now.getTime() > from.getTime() + LATE_AFTER_MS;
}

export async function hasOpenClaim(tripId: string) {
  const { data } = await createAdminClient()
    .from("trip_claims")
    .select("id")
    .eq("trip_id", tripId)
    .in("status", OPEN_CLAIM_STATUSES)
    .limit(1);
  return !!data?.length;
}

/** Claims waiting on Cascade, for the admin nav. */
export async function escalatedClaimCount() {
  const { count } = await createAdminClient()
    .from("trip_claims")
    .select("id", { count: "exact", head: true })
    .eq("status", "escalated");
  return count ?? 0;
}

/** The trip and claim, when the claim belongs to that trip. */
export async function loadClaim(tripId: string, claimId: string) {
  const admin = createAdminClient();
  const [{ data: trip }, { data: claim }] = await Promise.all([
    admin.from("trips").select(CLAIM_TRIP_SELECT).eq("id", tripId).maybeSingle(),
    admin.from("trip_claims").select("*").eq("id", claimId).eq("trip_id", tripId).maybeSingle(),
  ]);
  return trip && claim ? { trip: trip as ClaimTrip, claim } : null;
}

/**
 * Sends the guest a damage charge from a claim, through the normal charge path:
 * they pay or dispute it like any other, and the claim follows it.
 */
export async function askGuestToPay(
  trip: ClaimTrip,
  claim: TripClaim,
  input: { amountCents: number; description: string }
): Promise<ClaimResult> {
  if (claim.status !== "reported") return refuse("This claim already has a charge or has gone to Cascade.");
  const window = chargeWindow(trip, "damage", { linkedToClaim: true });
  if (!window.open) {
    return refuse(
      trip.status === "active"
        ? "You can ask the guest to pay once the trip is done."
        : `Claim charges can be sent for ${CLAIM_WINDOW_DAYS} days after the trip. That window has closed.`
    );
  }

  const admin = createAdminClient();
  const { data: charges } = await admin
    .from("trip_charges")
    .select("id, status")
    .eq("trip_id", trip.id)
    .eq("kind", "damage");
  if (charges?.some((c) => c.id === claim.charge_id && c.status === "declined")) {
    return refuse("Cascade declined this charge. Escalate the claim or close it.");
  }
  if (charges?.some((c) => OPEN_CHARGE_STATUSES.includes(c.status))) {
    return refuse("There's already an open damage charge on this trip.");
  }

  // Taken first, so a double tap can't send two charges.
  const { data: taken } = await admin
    .from("trip_claims")
    .update({ status: "with_guest", updated_at: new Date().toISOString() })
    .eq("id", claim.id)
    .eq("status", "reported")
    .select("id")
    .maybeSingle();
  if (!taken) return refuse("This claim already has a charge or has gone to Cascade.");

  const charge = await createCharge({
    tripId: trip.id,
    hostId: trip.host_id,
    guestId: trip.guest_id,
    kind: "damage",
    amountCents: input.amountCents,
    description: input.description,
    photos: claim.photos,
  });
  if (!charge) {
    await admin.from("trip_claims").update({ status: "reported" }).eq("id", claim.id);
    return refuse("Couldn't send the charge. Try again.", 500);
  }

  await admin.from("trip_claims").update({ charge_id: charge.id }).eq("id", claim.id);
  await notifyTrip(trip.id, "charge_requested", { amountCents: input.amountCents, note: input.description, key: charge.id });
  return { ok: true };
}

/** Hands the claim to Cascade. Documents are due 15 days from now. */
export async function escalateClaim(trip: ClaimTrip, claim: TripClaim, now = new Date()): Promise<ClaimResult> {
  if (now >= claimClosesAt(trip)) return refuse(`Claims can be escalated for ${CLAIM_WINDOW_DAYS} days after the trip. That window has closed.`);
  const { data } = await createAdminClient()
    .from("trip_claims")
    .update({
      status: "escalated",
      escalated_at: now.toISOString(),
      documents_due_at: new Date(now.getTime() + DOCUMENTS_DAYS * DAY_MS).toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", claim.id)
    .in("status", ["reported", "with_guest", "disputed"])
    .select("id")
    .maybeSingle();
  if (!data) return refuse("This claim can't be escalated any more.");
  await notifyTrip(trip.id, "claim_escalated", { key: claim.id });
  return { ok: true };
}

/** A claim can't end while its charge could still collect. */
async function chargeStillOpen(claim: Pick<TripClaim, "charge_id">) {
  if (!claim.charge_id) return false;
  const { data } = await createAdminClient().from("trip_charges").select("status").eq("id", claim.charge_id).maybeSingle();
  return !!data && OPEN_CHARGE_STATUSES.includes(data.status);
}

/** The host sorted it out or let it go. */
export async function closeClaimAsHost(trip: ClaimTrip, claim: TripClaim, note: string): Promise<ClaimResult> {
  const now = new Date().toISOString();
  const resolution = note.trim() || null;
  const { data } = await createAdminClient()
    .from("trip_claims")
    .update({ status: "closed", resolution_note: resolution, resolved_at: now, updated_at: now })
    .eq("id", claim.id)
    .eq("status", "reported")
    .select("id")
    .maybeSingle();
  if (!data) return refuse("This claim can't be closed from here.");
  await notifyTrip(trip.id, "claim_withdrawn", { key: claim.id, note: resolution ?? undefined });
  return { ok: true };
}

/** Cascade's note on a claim. It records the outcome and moves no money. */
export async function resolveClaim(claimId: string, decision: "resolved" | "closed", note: string): Promise<ClaimResult> {
  const admin = createAdminClient();
  const { data: claim } = await admin.from("trip_claims").select("*").eq("id", claimId).maybeSingle();
  if (!claim) return refuse("This claim doesn't exist.", 404);
  if (!isOpenClaim(claim)) return refuse("This claim is already settled.");
  if (await chargeStillOpen(claim)) return refuse("Settle its charge in Disputes first.");

  const now = new Date().toISOString();
  const { data } = await admin
    .from("trip_claims")
    .update({ status: decision, resolution_note: note, resolved_at: now, updated_at: now })
    .eq("id", claim.id)
    .in("status", OPEN_CLAIM_STATUSES)
    .select("id")
    .maybeSingle();
  if (!data) return refuse("This claim is already settled.");
  await notifyTrip(claim.trip_id, decision === "resolved" ? "claim_resolved" : "claim_closed", { key: claim.id, note });
  return { ok: true };
}
