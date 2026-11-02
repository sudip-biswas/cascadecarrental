import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHECKIN_BUCKET, CHECKIN_LIMITS } from "@/lib/guest-checks";
import { notify } from "@/lib/notify";
import { formatDateTime } from "@/lib/utils";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

const NAME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function photoType(file: File) {
  if (EXTENSIONS[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return NAME_TYPES[ext] ?? null;
}

function validatePhoto(file: unknown, label: string): { type: string } | NextResponse {
  if (!(file instanceof File) || file.size === 0) return fail(`Add a ${label} photo.`, 400);
  const type = photoType(file);
  if (!type) return fail(`The ${label} has to be a photo (JPG, PNG, WebP, HEIC).`, 400);
  if (file.size > CHECKIN_LIMITS.photoMaxBytes) return fail(`The ${label} has to be under 10 MB.`, 400);
  return { type };
}

/**
 * POST — guest submits their licence photo and selfie for host review.
 * Accepts FormData with `license` and `selfie` file fields.
 * Upserts the trip_checkins row so resubmissions after rejection work.
 */
export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Log in to check in.", 401);

  const admin = createAdminClient();

  const { data: trip } = await admin
    .from("trips")
    .select("id, guest_id, host_id, status, starts_at, vehicle:vehicles(make, model), host:profiles!host_id(full_name)")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return fail("Trip not found.", 404);
  if (trip.guest_id !== user.id) return fail("You're not on this trip.", 403);
  if (trip.status === "completed" || trip.status === "cancelled_guest" || trip.status === "cancelled_host") {
    return fail("This trip is already over.", 409);
  }

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Something's off with this form. Refresh and try again.", 400);

  const licenseFile = form.get("license");
  const selfieFile = form.get("selfie");

  const licenseCheck = validatePhoto(licenseFile, "licence");
  if (licenseCheck instanceof NextResponse) return licenseCheck;
  const selfieCheck = validatePhoto(selfieFile, "selfie");
  if (selfieCheck instanceof NextResponse) return selfieCheck;

  const storage = admin.storage.from(CHECKIN_BUCKET);
  const now = new Date().toISOString();

  // Upload licence photo
  const licensePath = `${tripId}/${crypto.randomUUID()}.${EXTENSIONS[licenseCheck.type]}`;
  const { error: licenseErr } = await storage.upload(licensePath, licenseFile as File, {
    contentType: licenseCheck.type,
    upsert: false,
  });
  if (licenseErr) return fail("Upload failed. Try again.", 500);

  // Upload selfie
  const selfiePath = `${tripId}/${crypto.randomUUID()}.${EXTENSIONS[selfieCheck.type]}`;
  const { error: selfieErr } = await storage.upload(selfiePath, selfieFile as File, {
    contentType: selfieCheck.type,
    upsert: false,
  });
  if (selfieErr) {
    await storage.remove([licensePath]);
    return fail("Upload failed. Try again.", 500);
  }

  // Load any existing checkin so we can clean up old photos after upsert
  const { data: existing } = await admin
    .from("trip_checkins")
    .select("license_path, selfie_path")
    .eq("trip_id", tripId)
    .maybeSingle();

  const { error: dbErr } = await admin.from("trip_checkins").upsert(
    {
      trip_id: tripId,
      guest_id: user.id,
      license_path: licensePath,
      selfie_path: selfiePath,
      status: "pending",
      host_notes: null,
      reviewed_by: null,
      reviewed_at: null,
      submitted_at: now,
      updated_at: now,
    },
    { onConflict: "trip_id" }
  );

  if (dbErr) {
    await storage.remove([licensePath, selfiePath]);
    return fail("Couldn't save your check-in. Try again.", 500);
  }

  // Remove old photos now that the DB row points to the new ones
  if (existing) {
    const old = [existing.license_path, existing.selfie_path].filter(
      (p) => p !== licensePath && p !== selfiePath
    );
    if (old.length) await storage.remove(old);
  }

  // Notify host
  const vehicle = trip.vehicle as unknown as { make: string; model: string } | null;
  const car = vehicle ? `${vehicle.make} ${vehicle.model}` : "car";
  await notify({
    userId: trip.host_id,
    kind: "checkin_submitted",
    title: `Review the check-in for the ${car}`,
    body: `Your guest submitted their licence and selfie. Approve before pick-up at ${formatDateTime(trip.starts_at)}.`,
    href: `/host/trips/${tripId}`,
    tripId,
    dedupeKey: `checkin_submitted:${tripId}:${now.slice(0, 10)}`,
    actionLabel: "Review check-in",
  });

  return NextResponse.json({ ok: true });
}
