import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/app/(host)/host/admin/_lib/admin";
import { notify } from "@/lib/notify";
import { formatDate, zonedInstant } from "@/lib/utils";

const schema = z.object({
  decision: z.enum(["approved", "rejected"]),
  notes: z.string().trim().max(2000).optional(),
});

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * POST — host (or admin) approves or rejects the guest's check-in submission.
 * Body: { decision: "approved" | "rejected", notes?: string }
 */
export async function POST(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Log in first.", 401);

  const admin = createAdminClient();

  const { data: trip } = await admin
    .from("trips")
    .select("id, host_id, guest_id, starts_at, vehicle:vehicles(make, model), guest:profiles!guest_id(full_name)")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return fail("Trip not found.", 404);
  if (trip.host_id !== user.id && !isAdmin(user)) return fail("Only the host can review this check-in.", 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Provide a decision of 'approved' or 'rejected'.", 400);
  const { decision, notes } = parsed.data;

  const { data: checkin } = await admin
    .from("trip_checkins")
    .select("id, status")
    .eq("trip_id", tripId)
    .maybeSingle();

  if (!checkin) return fail("No check-in submission found for this trip.", 404);
  if (checkin.status === "approved" && decision === "approved") {
    return NextResponse.json({ ok: true }); // Already approved, idempotent
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("trip_checkins")
    .update({
      status: decision,
      host_notes: decision === "rejected" ? (notes ?? null) : null,
      reviewed_by: user.id,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("trip_id", tripId);

  if (error) return fail("Couldn't save your decision. Try again.", 500);

  // Notify the guest
  const vehicle = trip.vehicle as unknown as { make: string; model: string } | null;
  const car = vehicle ? `${vehicle.make} ${vehicle.model}` : "car";
  const date = formatDate(zonedInstant(trip.starts_at), { month: "short", weekday: "short" });

  if (decision === "approved") {
    await notify({
      userId: trip.guest_id,
      kind: "checkin_approved",
      title: `You're cleared to pick up the ${car}`,
      body: `Your licence and selfie were approved. Pick-up is ${date}.`,
      href: `/trips/${tripId}`,
      tripId,
      dedupeKey: `checkin_approved:${tripId}`,
      actionLabel: "View trip",
    });
  } else {
    const reason = notes?.trim() || "Your check-in photos weren't accepted.";
    await notify({
      userId: trip.guest_id,
      kind: "checkin_rejected",
      title: `Check-in wasn't approved for the ${car}`,
      body: `${reason}\nPlease resubmit before pick-up on ${date}.`,
      href: `/trips/${tripId}#checks`,
      tripId,
      dedupeKey: `checkin_rejected:${tripId}:${now.slice(0, 10)}`,
      actionLabel: "Resubmit",
    });
  }

  return NextResponse.json({ ok: true });
}
