import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyTrip } from "@/lib/notify";
import { CHARGE_WINDOW_DAYS, chargeGuest, chargeWindow } from "@/lib/charges";
import { INSPECTION_BUCKET, milesDriven } from "@/lib/inspections";
import { formatCurrency } from "@/lib/utils";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

const PHOTOS_MAX = 6;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

/** Some phones send HEIC with no type, so fall back to the file name. */
function photoType(file: File) {
  if (EXTENSIONS[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ext === "heic" || ext === "heif" ? "image/heic" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : null;
}

const createSchema = z.object({
  kind: z.enum(["extra_miles", "fuel", "tolls", "cleaning", "smoking", "late_return", "damage", "other"]),
  // Ignored for extra miles: that one is worked out from the odometers.
  amountCents: z.coerce.number().int().min(100).max(2_000_000).optional(),
  description: z.string().trim().min(3).max(2000),
});

const updateSchema = z.object({
  chargeId: z.string().uuid(),
  action: z.enum(["pay", "dispute", "cancel"]),
  note: z.string().trim().max(2000).optional(),
});

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function caller() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The host sends a charge: extra miles, fuel, tolls, cleaning and so on. */
export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await caller();
  if (!user) return fail("Log in to send a charge.", 401);

  const admin = createAdminClient();
  const { data: trip } = await admin
    .from("trips")
    .select("id, host_id, guest_id, status, ends_at")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip || trip.host_id !== user.id) return fail("Trip not found.", 404);

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Something's off with this form. Refresh and try again.", 400);
  const parsed = createSchema.safeParse({
    kind: form.get("kind"),
    amountCents: form.get("amountCents") || undefined,
    description: form.get("description"),
  });
  if (!parsed.success) return fail("Pick what it's for, add an amount of at least $1 and a short note.", 400);
  const { kind, description } = parsed.data;

  const window = chargeWindow(trip);
  if (!window.open) {
    return fail(
      trip.status === "completed"
        ? `Charges can be sent for ${CHARGE_WINDOW_DAYS} days after the trip. That window has closed.`
        : "You can send charges once the trip has started.",
      409
    );
  }
  if (window.activeOnly && kind !== "tolls") return fail("During the trip you can only send tolls. The rest can wait until it's done.", 409);

  let amountCents = parsed.data.amountCents;
  if (kind === "extra_miles") {
    const miles = await milesDriven(tripId);
    if (!miles) return fail("Extra miles need both odometer readings, at check-in and check-out.", 409);
    if (miles.overCents < 100) return fail("The guest stayed within the miles included.", 409);
    amountCents = miles.overCents;
  }
  if (!amountCents) return fail("Add an amount of at least $1.", 400);

  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > PHOTOS_MAX) return fail(`Up to ${PHOTOS_MAX} photos.`, 400);
  const types: string[] = [];
  for (const file of files) {
    const type = photoType(file);
    if (!type) return fail("Photos have to be JPG, PNG, WebP or HEIC.", 400);
    if (file.size > PHOTO_MAX_BYTES) return fail("Each photo has to be under 10 MB.", 400);
    types.push(type);
  }

  const storage = admin.storage.from(INSPECTION_BUCKET);
  const photos: string[] = [];
  for (const [i, file] of files.entries()) {
    const path = `${tripId}/charges/${crypto.randomUUID()}.${EXTENSIONS[types[i]]}`;
    const { error } = await storage.upload(path, file, { contentType: types[i], upsert: false });
    if (error) {
      if (photos.length) await storage.remove(photos);
      return fail("Upload failed. Try again.", 500);
    }
    photos.push(path);
  }

  const { data: charge, error } = await admin
    .from("trip_charges")
    .insert({
      trip_id: tripId,
      host_id: trip.host_id,
      guest_id: trip.guest_id,
      kind,
      amount_cents: amountCents,
      description,
      photos,
    })
    .select("*")
    .single();
  if (error || !charge) {
    if (photos.length) await storage.remove(photos);
    return fail("Couldn't send the charge. Try again.", 500);
  }

  await notifyTrip(tripId, "charge_requested", { amountCents, note: description, key: charge.id });
  return NextResponse.json({ charge });
}

/** The guest pays or disputes a charge; the host can take back one that's still open. */
export async function PATCH(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const user = await caller();
  if (!user) return fail("Log in to answer this charge.", 401);

  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Something's off. Refresh and try again.", 400);
  const { chargeId, action, note } = parsed.data;

  const admin = createAdminClient();
  const { data: charge } = await admin
    .from("trip_charges")
    .select("*")
    .eq("id", chargeId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!charge || (charge.guest_id !== user.id && charge.host_id !== user.id)) return fail("Charge not found.", 404);
  const now = new Date().toISOString();

  if (action === "cancel") {
    if (charge.host_id !== user.id) return fail("Only the host can take a charge back.", 403);
    const { data } = await admin
      .from("trip_charges")
      .update({ status: "cancelled", resolved_at: now })
      .eq("id", chargeId)
      .in("status", ["requested", "disputed", "failed"])
      .select("status")
      .maybeSingle();
    if (!data) return fail("This charge is already settled.", 409);
    return NextResponse.json({ status: "cancelled" });
  }

  if (charge.guest_id !== user.id) return fail("Only the guest can answer a charge.", 403);

  if (action === "dispute") {
    if (!note || note.length < 3) return fail("Tell us why you disagree.", 400);
    const { data } = await admin
      .from("trip_charges")
      .update({ status: "disputed", guest_note: note, responded_at: now })
      .eq("id", chargeId)
      .in("status", ["requested", "failed"])
      .select("status")
      .maybeSingle();
    if (!data) return fail("This charge can't be disputed any more.", 409);
    await notifyTrip(tripId, "charge_disputed", { amountCents: charge.amount_cents, note, key: chargeId });
    return NextResponse.json({ status: "disputed" });
  }

  const result = await chargeGuest(chargeId);
  if (!result.ok) return fail(result.error, 402);
  return NextResponse.json({
    status: "paid",
    message: result.fromDeposit
      ? `Paid ${formatCurrency(charge.amount_cents)} from your deposit.`
      : `Paid ${formatCurrency(charge.amount_cents)}.`,
  });
}
