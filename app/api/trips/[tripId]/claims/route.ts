import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLAIM_WINDOW_DAYS } from "@/lib/charge-windows";
import { CLAIM_TRIP_SELECT, type ClaimTrip, claimWindow, hasOpenClaim, isLateReport } from "@/lib/claims";
import { UPLOAD_MAX_BYTES } from "@/lib/licence";
import { notifyTrip } from "@/lib/notify";
import { readPhotos, removePhotos, uploadPhotos } from "@/lib/trip-photos";
import { zonedInstant } from "@/lib/utils";

const DAY_MS = 86_400_000;

const schema = z.object({
  incidentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  incidentTime: z.string().regex(/^\d{2}:\d{2}$/),
  description: z.string().trim().min(10).max(2000),
  estimateCents: z.coerce.number().int().min(100).max(2_000_000).optional(),
});

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** The host or the guest reports damage on an active or finished trip. */
export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Log in to report damage.", 401);

  const admin = createAdminClient();
  const { data } = await admin.from("trips").select(CLAIM_TRIP_SELECT).eq("id", tripId).maybeSingle();
  const trip = data as ClaimTrip | null;
  if (!trip || (trip.host_id !== user.id && trip.guest_id !== user.id)) return fail("Trip not found.", 404);
  const reportedBy = trip.host_id === user.id ? "host" : "guest";

  const window = claimWindow(trip);
  if (!window.open) {
    return fail(
      trip.status === "completed"
        ? `Damage can be reported for ${CLAIM_WINDOW_DAYS} days after the trip. That window has closed.`
        : "You can report damage once the trip has started.",
      409
    );
  }
  if (await hasOpenClaim(tripId)) return fail("This trip already has an open claim.", 409);

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Something's off with this form. Refresh and try again.", 400);
  const parsed = schema.safeParse({
    incidentDate: form.get("incidentDate"),
    incidentTime: form.get("incidentTime"),
    description: form.get("description"),
    estimateCents: form.get("estimateCents") || undefined,
  });
  if (!parsed.success) return fail("Add when it happened and describe the damage in at least 10 characters.", 400);

  const now = new Date();
  const incident = zonedInstant(parsed.data.incidentDate, parsed.data.incidentTime);
  const earliest = new Date(trip.starts_at).getTime() - DAY_MS;
  const latest = Math.min(now.getTime(), new Date(trip.ends_at).getTime() + DAY_MS);
  if (Number.isNaN(incident.getTime()) || incident.getTime() < earliest || incident.getTime() > latest) {
    return fail("Pick a time during the trip.", 400);
  }

  const photos = readPhotos(form);
  if (photos.error !== undefined) return fail(photos.error, 400);
  if (photos.files.reduce((sum, f) => sum + f.size, 0) > UPLOAD_MAX_BYTES) return fail("Those photos are too big together. Send fewer.", 413);

  const paths = await uploadPhotos(tripId, "claims", photos.files, photos.types);
  if (!paths) return fail("Upload failed. Try again.", 500);

  const { data: claim, error } = await admin
    .from("trip_claims")
    .insert({
      trip_id: tripId,
      vehicle_id: trip.vehicle_id,
      host_id: trip.host_id,
      guest_id: trip.guest_id,
      reported_by: reportedBy,
      incident_at: incident.toISOString(),
      description: parsed.data.description,
      photos: paths,
      estimate_cents: reportedBy === "host" ? (parsed.data.estimateCents ?? null) : null,
      reported_late: isLateReport(reportedBy, trip, incident, now),
    })
    .select("*")
    .single();
  if (error || !claim) {
    await removePhotos(paths);
    // 23505: another report got in first.
    return error?.code === "23505" ? fail("This trip already has an open claim.", 409) : fail("Couldn't save the report. Try again.", 500);
  }

  await notifyTrip(tripId, reportedBy === "host" ? "claim_reported_by_host" : "claim_reported_by_guest", {
    note: claim.description,
    key: claim.id,
  });
  return NextResponse.json({ claim });
}
