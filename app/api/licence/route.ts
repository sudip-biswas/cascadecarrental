import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { askForLicenceReview } from "@/lib/guest-checks";
import { LICENCE_BUCKET } from "@/lib/licence";
import { toDateKey } from "@/lib/utils";

/** Types a host's browser can always show, so HEIC is converted before it gets here. */
const EXTENSIONS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 10 * 1024 * 1024;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function photoProblem(file: FormDataEntryValue | null, label: string): string | null {
  if (!(file instanceof File) || file.size === 0) return `Add ${label}.`;
  if (!EXTENSIONS[file.type]) return `${label[0].toUpperCase()}${label.slice(1)} has to be a JPG, PNG or WebP photo.`;
  if (file.size > MAX_BYTES) return `${label[0].toUpperCase()}${label.slice(1)} has to be under 10 MB.`;
  return null;
}

/**
 * Takes the guest's licence photo and a selfie holding it, and asks the host
 * of any booked trip to compare them with the booking. Sending new photos
 * replaces the old ones and starts the review again.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Log in to upload your licence.", 401);

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Something's off with this form. Refresh and try again.", 400);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("driving_license_verified, date_of_birth")
    .eq("id", user.id)
    .single();
  if (!profile) return fail("We couldn't find your profile.", 404);
  if (profile.driving_license_verified) return fail("Your licence is already checked.", 400);

  const licence = form.get("licence");
  const selfie = form.get("selfie");
  const problem = photoProblem(licence, "the licence photo") ?? photoProblem(selfie, "the selfie");
  if (problem) return fail(problem, 400);

  // Hosts compare the licence with the date of birth on the booking.
  const dob = form.get("date_of_birth");
  const birthday = typeof dob === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null;
  if (!profile.date_of_birth && !birthday) return fail("Add your date of birth, as it is on your licence.", 400);
  if (birthday && birthday >= toDateKey(new Date())) return fail("Check your date of birth.", 400);

  const storage = admin.storage.from(LICENCE_BUCKET);
  const save = async (file: File) => {
    const path = `${user.id}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
    const { error } = await storage.upload(path, file, { contentType: file.type, upsert: false });
    return error ? null : path;
  };
  const [licencePath, selfiePath] = await Promise.all([save(licence as File), save(selfie as File)]);
  const uploaded = [licencePath, selfiePath].filter((p): p is string => !!p);
  if (uploaded.length < 2) {
    if (uploaded.length) await storage.remove(uploaded);
    return fail("Upload failed. Try again.", 500);
  }

  const { data: previous } = await admin.from("guest_licences").select("licence_path, selfie_path").eq("user_id", user.id).maybeSingle();
  const now = new Date().toISOString();
  const { error } = await admin.from("guest_licences").upsert({
    user_id: user.id,
    licence_path: licencePath as string,
    selfie_path: selfiePath as string,
    submitted_at: now,
    reviewed_at: null,
    reviewed_by: null,
  });
  if (error) {
    await storage.remove(uploaded);
    return fail("Couldn't save your photos. Try again.", 500);
  }
  await admin
    .from("profiles")
    .update({
      identity_status: "pending",
      identity_error: null,
      ...(!profile.date_of_birth && birthday ? { date_of_birth: birthday } : {}),
      updated_at: now,
    })
    .eq("id", user.id);
  if (previous) await storage.remove([previous.licence_path, previous.selfie_path]);

  // Booked trips can be reviewed now. Anything booked later asks when it's booked.
  const { data: trips } = await admin
    .from("trips")
    .select("id")
    .eq("guest_id", user.id)
    .in("status", ["approved", "active"])
    .gt("ends_at", now);
  after(() => Promise.all((trips ?? []).map((t) => askForLicenceReview(t.id))).catch((err) => console.error("[licence] notify failed", err)));

  return NextResponse.json({ ok: true });
}
