import { createAdminClient } from "@/lib/supabase/admin";
import type { GuestInsurance, Profile, Trip } from "@/lib/supabase/types";
import { notify } from "@/lib/notify";
import { formatDateTime, toDateKey } from "@/lib/utils";

/**
 * Pre-trip checks, the way Turo asks for them after booking: a checked
 * licence with a matching selfie, and cover for the car, either the guest's
 * own insurance or a protection plan on the trip. The guest can't check in
 * until both are done. guest_trip_checks_missing in the database holds the
 * same rules and refuses the check-in.
 */

export type CheckId = "licence" | "cover";

export const INSURANCE_BUCKET = "insurance-cards";
export const INSURANCE_LIMITS = { photoMaxBytes: 10 * 1024 * 1024 } as const;

/** Photo links last long enough to look over the form. */
const SIGNED_URL_SECONDS = 60 * 60;

export const PLAN_NAMES: Record<NonNullable<Trip["protection_plan"]>, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
};

type ChecksTrip = Pick<Trip, "starts_at" | "protection_plan">;
type ChecksProfile = Pick<Profile, "driving_license_verified" | "identity_status" | "identity_error">;
type ChecksInsurance = Pick<GuestInsurance, "has_none" | "insurer" | "expires_on">;

export type Cover =
  | { kind: "plan"; plan: string }
  | { kind: "insurance"; insurer: string; expiresOn: string }
  | { kind: "expired"; insurer: string; expiresOn: string }
  | { kind: "declined" }
  | { kind: "missing" };

/** What covers the car on this trip, or why nothing does yet. */
export function tripCover(trip: ChecksTrip, insurance: ChecksInsurance | null): Cover {
  if (trip.protection_plan) return { kind: "plan", plan: PLAN_NAMES[trip.protection_plan] };
  if (!insurance) return { kind: "missing" };
  if (insurance.has_none || !insurance.insurer || !insurance.expires_on) return { kind: "declined" };
  // The policy has to run at least until pick-up day.
  return insurance.expires_on >= toDateKey(trip.starts_at)
    ? { kind: "insurance", insurer: insurance.insurer, expiresOn: insurance.expires_on }
    : { kind: "expired", insurer: insurance.insurer, expiresOn: insurance.expires_on };
}

export interface GuestChecks {
  licence: "verified" | ChecksProfile["identity_status"];
  licenceError: string | null;
  cover: Cover;
  missing: CheckId[];
}

export function guestChecks(trip: ChecksTrip, profile: ChecksProfile | null, insurance: ChecksInsurance | null): GuestChecks {
  const licence = profile?.driving_license_verified ? "verified" : (profile?.identity_status ?? "unverified");
  const cover = tripCover(trip, insurance);
  const missing: CheckId[] = [];
  if (licence !== "verified") missing.push("licence");
  if (cover.kind !== "plan" && cover.kind !== "insurance") missing.push("cover");
  return { licence, licenceError: profile?.identity_error ?? null, cover, missing };
}

/** A trip's checks, read on the server. Only call after checking the viewer is on the trip. */
export async function loadGuestChecks(tripId: string): Promise<(GuestChecks & { guestId: string; startsAt: string }) | null> {
  const admin = createAdminClient();
  const { data: trip } = await admin
    .from("trips")
    .select("guest_id, starts_at, protection_plan")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return null;
  const [{ data: profile }, { data: insurance }] = await Promise.all([
    admin.from("profiles").select("driving_license_verified, identity_status, identity_error").eq("id", trip.guest_id).maybeSingle(),
    admin.from("guest_insurance").select("has_none, insurer, expires_on").eq("user_id", trip.guest_id).maybeSingle(),
  ]);
  return { ...guestChecks(trip, profile, insurance), guestId: trip.guest_id, startsAt: trip.starts_at };
}

/** The guest's own policy, with a short-lived link to the card photo. For the guest only. */
export async function loadOwnInsurance(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("guest_insurance").select("*").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  let cardUrl: string | null = null;
  if (data.card_path) {
    const { data: signed } = await admin.storage.from(INSURANCE_BUCKET).createSignedUrl(data.card_path, SIGNED_URL_SECONDS);
    cardUrl = signed?.signedUrl ?? null;
  }
  return { ...data, cardUrl };
}

/** The checks reminder goes out this long before pick-up. */
const REMIND_HOURS = 48;
const HOUR = 60 * 60 * 1000;

const CHECK_LINES: Record<CheckId, string> = {
  licence: "Check your licence: a photo of it and a quick selfie.",
  cover: "Add your insurance, since this trip has no protection plan.",
};

/**
 * Cron: tells guests whose pick-up is in the next 48 hours what's left
 * before they can check in. Each trip is claimed first, so it's sent once.
 */
export async function sendCheckReminders() {
  const admin = createAdminClient();
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();

  const { data: trips } = await admin
    .from("trips")
    .update({ checks_reminded_at: iso(now) })
    .eq("status", "approved")
    .eq("payment_status", "captured")
    .is("checks_reminded_at", null)
    .gt("starts_at", iso(now))
    .lte("starts_at", iso(now + REMIND_HOURS * HOUR))
    .select("id, guest_id, starts_at, protection_plan, vehicle:vehicles(make, model)");

  let sent = 0;
  for (const trip of trips ?? []) {
    const checks = await loadGuestChecks(trip.id);
    if (!checks?.missing.length) continue;
    const vehicle = trip.vehicle as unknown as { make: string; model: string } | null;
    const car = vehicle ? `${vehicle.make} ${vehicle.model}` : "car";
    await notify({
      userId: trip.guest_id,
      kind: "checks_due",
      title: `Finish your checks before you pick up the ${car}`,
      body: [...checks.missing.map((c) => CHECK_LINES[c]), `You can't check in until it's done. Pick-up is ${formatDateTime(trip.starts_at)}.`].join("\n"),
      href: `/trips/${trip.id}#checks`,
      tripId: trip.id,
      dedupeKey: `checks_due:${trip.id}`,
      actionLabel: "Finish your checks",
    });
    sent++;
  }
  return { checks: sent };
}
