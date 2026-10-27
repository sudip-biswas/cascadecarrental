import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guestCancellation } from "@/lib/cancellation";
import { CANCEL_REASON } from "@/lib/trip-status";
import { settleCancellation } from "@/lib/trips";
import { notifyTripLater } from "@/lib/notify";
import { syncTripMessagesLater } from "@/lib/scheduled-messages";

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * Guests get money back by the cancellation terms. A host cancelling always
 * refunds the guest in full.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Unauthorized", 401);

  const admin = createAdminClient();
  const { data: trip } = await admin.from("trips").select("*").eq("id", tripId).single();
  if (!trip) return fail("Trip not found", 404);

  const isGuest = trip.guest_id === user.id;
  const isHost = trip.host_id === user.id;
  if (!isGuest && !isHost) return fail("Forbidden", 403);

  let refundCents: number;
  if (isGuest) {
    const terms = guestCancellation(trip);
    if (!terms.canCancel) return fail(terms.summary, 409);
    refundCents = terms.refundCents;
  } else {
    if (trip.status !== "pending" && trip.status !== "approved") {
      return fail("This trip can't be cancelled.", 409);
    }
    refundCents = trip.total_cents;
  }

  let paymentStatus;
  try {
    paymentStatus = await settleCancellation(trip, refundCents);
  } catch {
    return fail("Couldn't reach the payment provider. Nothing was changed, try again.", 502);
  }

  const now = new Date().toISOString();
  const status = isGuest ? "cancelled_guest" : "cancelled_host";
  const { error } = await admin
    .from("trips")
    .update({
      status,
      payment_status: paymentStatus,
      cancellation_reason: isGuest ? CANCEL_REASON.byGuest : CANCEL_REASON.byHost,
      cancelled_at: now,
      updated_at: now,
    })
    .eq("id", tripId);
  if (error) return fail("Failed to cancel trip", 500);

  const refunded = paymentStatus === "refunded" ? refundCents : 0;
  if (isGuest) notifyTripLater(tripId, "cancelled_by_guest", { amountCents: refunded || undefined });
  else notifyTripLater(tripId, "cancelled_by_host");
  syncTripMessagesLater(tripId);

  return NextResponse.json({ status, refundCents: refunded });
}
