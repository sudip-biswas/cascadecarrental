import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GuestInsurance, Trip } from "@/lib/supabase/types";
import { notify } from "@/lib/notify";
import { LICENCE_BUCKET } from "@/lib/licence";
import { formatDateTime, toDateKey } from "@/lib/utils";

/**
 * Pre-trip checks, the way Turo asks for them after booking: a licence photo
 * and a selfie holding it, approved by the host, and cover for the car, either
 * the guest's own insurance or a protection plan on the trip. The guest can't check in
 * until both are done. guest_trip_checks_missing in the database holds the
 * same rules and refuses the check-in.
 */

export type CheckId = "licence" | "cover";

export const INSURANCE_BUCKET = "insurance-cards";
export const INSURANCE_LIMITS = { photoMaxBytes: 10 * 1024 * 1024 } as const;

export const CHECKIN_BUCKET = "checkin-photos";
export const CHECKIN_LIMITS = { photoMaxBytes: 10 * 1024 * 1024 } as const;

/** Photo links last long enough to look over the form. */
const SIGNED_URL_SECONDS = 60 * 60;

export const PLAN_NAMES: Record<NonNullable<Trip["protection_plan"]>, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
};

type ChecksTrip = Pick<Trip, "starts_at" | "protection_plan">;
type CheckinRow = { status: "pending" | "approved" | "rejected"; host_notes: string | null } | null;
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
  licence: "verified" | "unverified" | "pending" | "failed";
  licenceError: string | null;
  cover: Cover;
  missing: CheckId[];
}

export function guestChecks(trip: ChecksTrip, checkin: CheckinRow, insurance: ChecksInsurance | null): GuestChecks {
  const licence = !checkin
    ? "unverified"
    : checkin.status === "approved"
      ? "verified"
      : checkin.status === "pending"
        ? "pending"
        : "failed"; // rejected
  const licenceError =
    checkin?.status === "rejected" ? (checkin.host_notes ?? "Your check-in photos weren't accepted.") : null;
  const cover = tripCover(trip, insurance);
  const missing: CheckId[] = [];
  if (licence !== "verified") missing.push("licence");
  if (cover.kind !== "plan" && cover.kind !== "insurance") missing.push("cover");
  return { licence, licenceError, cover, missing };
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
  const [{ data: checkin }, { data: insurance }] = await Promise.all([
    admin.from("trip_checkins").select("status, host_notes").eq("trip_id", tripId).maybeSingle(),
    admin.from("guest_insurance").select("has_none, insurer, expires_on").eq("user_id", trip.guest_id).maybeSingle(),
  ]);
  return { ...guestChecks(trip, checkin, insurance), guestId: trip.guest_id, startsAt: trip.starts_at };
}

/**
 * The trip's check-in record with signed photo URLs (1 hour). For the host
 * review panel. Returns null if no submission has been made.
 */
export async function loadTripCheckin(tripId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("trip_checkins")
    .select("id, status, host_notes, reviewed_at, submitted_at, license_path, selfie_path")
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!data) return null;

  const paths = [data.license_path, data.selfie_path];
  const { data: signed } = await admin.storage.from(CHECKIN_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  const urlMap = new Map((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));

  return {
    ...data,
    licenseUrl: urlMap.get(data.license_path) ?? null,
    selfieUrl: urlMap.get(data.selfie_path) ?? null,
  };
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

/** Short-lived links to a guest's licence photos. Only call for the guest's host or Cascade. */
export async function loadLicencePhotos(guestId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("guest_licences").select("licence_path, selfie_path").eq("user_id", guestId).maybeSingle();
  if (!data) return null;
  const { data: signed } = await admin.storage
    .from(LICENCE_BUCKET)
    .createSignedUrls([data.licence_path, data.selfie_path], SIGNED_URL_SECONDS);
  return { licenceUrl: signed?.[0]?.signedUrl ?? null, selfieUrl: signed?.[1]?.signedUrl ?? null };
}

/** Tells the host a licence is waiting for them on this trip, once per set of photos. */
export async function askForLicenceReview(tripId: string) {
  const admin = createAdminClient();
  const { data: trip } = await admin
    .from("trips")
    .select("guest_id, host_id, guest:profiles!guest_id(full_name, identity_status), vehicle:vehicles(make, model)")
    .eq("id", tripId)
    .maybeSingle();
  const guest = trip?.guest as unknown as Pick<Profile, "full_name" | "identity_status"> | null;
  if (!trip || guest?.identity_status !== "pending") return;
  const { data: licence } = await admin.from("guest_licences").select("submitted_at").eq("user_id", trip.guest_id).maybeSingle();
  if (!licence) return;
  const name = guest.full_name.trim().split(/\s+/)[0] || "Your guest";
  const vehicle = trip.vehicle as unknown as { make: string; model: string } | null;
  await notify({
    userId: trip.host_id,
    kind: "licence_review",
    title: `Check ${name}'s licence`,
    body: `${vehicle ? `${vehicle.make} ${vehicle.model}. ` : ""}Compare the photos with the booking. ${name} can't check in until you approve.`,
    href: `/host/trips/${tripId}#licence`,
    tripId,
    dedupeKey: `licence_review:${tripId}:${licence.submitted_at}`,
    actionLabel: "Check the licence",
  });
}

/** askForLicenceReview once the response is out. */
export function askForLicenceReviewLater(tripId: string): void {
  const send = () => askForLicenceReview(tripId).catch((err) => console.error("[licence] notify failed", err));
  try {
    after(send);
  } catch {
    void send();
  }
}

/** The host's reminder 2 days before pick-up, separate from the note when the photos arrive. */
async function askForLicenceReviewNudge(tripId: string) {
  const { data: trip } = await createAdminClient().from("trips").select("host_id").eq("id", tripId).maybeSingle();
  if (!trip) return;
  await notify({
    userId: trip.host_id,
    kind: "licence_review",
    title: "A guest's licence is still waiting for you",
    body: "Pick-up is within 2 days, and they can't check in until you approve.",
    href: `/host/trips/${tripId}#licence`,
    tripId,
    dedupeKey: `licence_review_due:${tripId}`,
    actionLabel: "Check the licence",
  });
}

/** The checks reminder goes out this long before pick-up. */
const REMIND_HOURS = 48;
const HOUR = 60 * 60 * 1000;

const CHECK_LINES: Record<CheckId, string> = {
  licence: "Upload a photo of your licence and a selfie holding it.",
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
    // Photos already sent: the wait is on the host, not the guest.
    if (checks.licence === "pending") await askForLicenceReviewNudge(trip.id);
    const missing = checks.licence === "pending" ? checks.missing.filter((c) => c !== "licence") : checks.missing;
    if (!missing.length) continue;
    const vehicle = trip.vehicle as unknown as { make: string; model: string } | null;
    const car = vehicle ? `${vehicle.make} ${vehicle.model}` : "car";
    await notify({
      userId: trip.guest_id,
      kind: "checks_due",
      title: `Finish your checks before you pick up the ${car}`,
      body: [...missing.map((c) => CHECK_LINES[c]), `You can't check in until it's done. Pick-up is ${formatDateTime(trip.starts_at)}.`].join("\n"),
      href: `/trips/${trip.id}#checks`,
      tripId: trip.id,
      dedupeKey: `checks_due:${trip.id}`,
      actionLabel: "Finish your checks",
    });
    sent++;
  }
  return { checks: sent };
}
