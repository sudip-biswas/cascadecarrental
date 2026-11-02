import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { LICENCE_REJECT_REASONS } from "@/lib/licence";

const schema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), tripId: z.string().uuid() }),
  z.object({ decision: z.literal("reject"), tripId: z.string().uuid(), reason: z.enum(LICENCE_REJECT_REASONS) }),
]);

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** The host of a booked trip, or Cascade, approves or rejects the guest's licence. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Log in first.", 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Choose a reason first.", 400);
  const { tripId } = parsed.data;

  const admin = createAdminClient();
  const { data: trip } = await admin.from("trips").select("guest_id, host_id, status").eq("id", tripId).maybeSingle();
  const isAdmin = !!process.env.ADMIN_USER_ID && user.id === process.env.ADMIN_USER_ID;
  if (!trip || (trip.host_id !== user.id && !isAdmin)) return fail("That isn't your trip.", 403);
  if (trip.guest_id === user.id) return fail("Someone else has to check your licence.", 403);
  if (trip.status !== "approved" && trip.status !== "active") return fail("This trip isn't booked.", 409);

  const { data: licence } = await admin.from("guest_licences").select("submitted_at").eq("user_id", trip.guest_id).maybeSingle();
  if (!licence) return fail("There's no licence to check yet.", 409);

  const now = new Date().toISOString();
  const update =
    parsed.data.decision === "approve"
      ? { driving_license_verified: true, identity_verified: true, identity_status: "verified" as const, identity_error: null }
      : { identity_status: "failed" as const, identity_error: parsed.data.reason };
  // Only the review still waiting counts, so a second click or a second host changes nothing.
  const { data: changed } = await admin
    .from("profiles")
    .update({ ...update, updated_at: now })
    .eq("id", trip.guest_id)
    .eq("identity_status", "pending")
    .select("id");
  if (!changed?.length) return fail("This licence has already been reviewed.", 409);

  await admin.from("guest_licences").update({ reviewed_at: now, reviewed_by: user.id }).eq("user_id", trip.guest_id);

  await notify(
    parsed.data.decision === "approve"
      ? {
          userId: trip.guest_id,
          kind: "licence_approved",
          title: "Your licence is approved",
          body: "You won't need to send it again.",
          href: `/trips/${tripId}#checks`,
          tripId,
          dedupeKey: `licence_approved:${trip.guest_id}:${licence.submitted_at}`,
          actionLabel: "See your trip",
        }
      : {
          userId: trip.guest_id,
          kind: "licence_rejected",
          title: "Your licence needs another look",
          body: `${parsed.data.reason}\nSend new photos before pick-up. You can't check in until it's approved.`,
          href: `/trips/${tripId}#checks`,
          tripId,
          dedupeKey: `licence_rejected:${trip.guest_id}:${licence.submitted_at}`,
          actionLabel: "Send new photos",
        }
  );

  return NextResponse.json({ ok: true });
}
