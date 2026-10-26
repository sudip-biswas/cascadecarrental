import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { INSPECTION_BUCKET, INSPECTION_LIMITS, inspectionOpen, loadInspections } from "@/lib/inspections";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};

/** Some phones send HEIC with no type, so fall back to the file name. */
const NAME_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" };

const schema = z.object({
  kind: z.enum(["pickup", "return"]),
  odometer_mi: z.coerce.number().int().min(0).max(2_000_000),
  fuel_pct: z.coerce.number().int().min(0).max(100),
  notes: z.string().trim().max(INSPECTION_LIMITS.notesMax).optional(),
});

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function photoType(file: File) {
  if (EXTENSIONS[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return NAME_TYPES[ext] ?? null;
}

/** The caller's side of the trip, or null when they aren't on it. */
async function loadTrip(tripId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, trip: null };
  const { data: trip } = await createAdminClient()
    .from("trips")
    .select("id, guest_id, host_id, status, starts_at, ends_at, completed_at")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip || (trip.guest_id !== user.id && trip.host_id !== user.id)) return { user, trip: null };
  return { user, trip, role: trip.guest_id === user.id ? ("guest" as const) : ("host" as const) };
}

export async function GET(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { user, trip } = await loadTrip(tripId);
  if (!user) return fail("Log in to see this trip.", 401);
  if (!trip) return fail("Trip not found.", 404);
  return NextResponse.json({ inspections: await loadInspections(tripId) });
}

export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { user, trip, role } = await loadTrip(tripId);
  if (!user) return fail("Log in to check in.", 401);
  if (!trip || !role) return fail("Trip not found.", 404);

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Something's off with this form. Refresh and try again.", 400);
  const parsed = schema.safeParse({
    kind: form.get("kind"),
    odometer_mi: form.get("odometer_mi"),
    fuel_pct: form.get("fuel_pct"),
    notes: form.get("notes") ?? undefined,
  });
  if (!parsed.success) return fail("Add the odometer reading and fuel level.", 400);
  const { kind, odometer_mi, fuel_pct, notes } = parsed.data;

  if (!inspectionOpen(trip, kind)) {
    return fail(
      kind === "pickup"
        ? "Check-in opens 24 hours before pick-up."
        : "Check-out is open during the trip and for 24 hours after it ends.",
      409
    );
  }

  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  const types: string[] = [];
  for (const file of files) {
    const type = photoType(file);
    if (!type) return fail("Photos have to be JPG, PNG, WebP or HEIC.", 400);
    if (file.size > INSPECTION_LIMITS.photoMaxBytes) return fail("Each photo has to be under 10 MB.", 400);
    types.push(type);
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("trip_inspections")
    .select("photos")
    .eq("trip_id", tripId)
    .eq("kind", kind)
    .eq("role", role)
    .maybeSingle();
  // Sending again replaces the old one, keeping only the photos the form still lists.
  const keepAsked = new Set(form.getAll("keep").map(String));
  const kept = (existing?.photos ?? []).filter((p) => keepAsked.has(p));

  const total = kept.length + files.length;
  if (total === 0) return fail("Add at least one photo of the car.", 400);
  if (total > INSPECTION_LIMITS.photosMax) return fail(`Up to ${INSPECTION_LIMITS.photosMax} photos.`, 400);

  const storage = admin.storage.from(INSPECTION_BUCKET);
  const uploaded: string[] = [];
  for (const [i, file] of files.entries()) {
    const type = types[i];
    const path = `${tripId}/${kind}-${role}-${crypto.randomUUID()}.${EXTENSIONS[type]}`;
    const { error } = await storage.upload(path, file, { contentType: type, upsert: false });
    if (error) {
      if (uploaded.length) await storage.remove(uploaded);
      return fail("Upload failed. Try again.", 500);
    }
    uploaded.push(path);
  }

  const { data: row, error } = await admin
    .from("trip_inspections")
    .upsert(
      {
        trip_id: tripId,
        kind,
        role,
        recorded_by: user.id,
        odometer_mi,
        fuel_pct,
        notes: notes || null,
        photos: [...kept, ...uploaded],
        created_at: new Date().toISOString(),
      },
      { onConflict: "trip_id,kind,role" }
    )
    .select("*")
    .single();
  if (error || !row) {
    if (uploaded.length) await storage.remove(uploaded);
    return fail("Couldn't save it. Try again.", 500);
  }

  const dropped = (existing?.photos ?? []).filter((p) => !keepAsked.has(p));
  if (dropped.length) await storage.remove(dropped);

  // Tell the other side once. Fixing a reading later doesn't send it again.
  const otherIsGuest = role === "host";
  const who = role === "guest" ? "Your guest" : "Your host";
  await notify({
    userId: otherIsGuest ? trip.guest_id : trip.host_id,
    kind: "inspection",
    title: `${who} ${kind === "pickup" ? "checked in" : "checked out"}`,
    body: `${total === 1 ? "1 photo" : `${total} photos`}, odometer ${odometer_mi.toLocaleString("en-US")} mi.`,
    href: otherIsGuest ? `/trips/${tripId}` : `/host/trips/${tripId}`,
    tripId,
    dedupeKey: `inspection-${tripId}-${kind}-${role}`,
    email: false,
  });

  return NextResponse.json({ inspection: row });
}
