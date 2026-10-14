import type { Trip } from "@/lib/supabase/types";

/** "Pay now" trips can still be cancelled for free this long after they're confirmed. */
const GRACE_MS = 24 * 60 * 60 * 1000;

type CancellableTrip = Pick<
  Trip,
  "rate_type" | "created_at" | "approved_at" | "starts_at" | "total_cents" | "payment_status" | "status"
>;

export interface CancellationTerms {
  canCancel: boolean;
  /** What goes back to the guest's card. Zero when nothing was charged yet. */
  refundCents: number;
  /** One line for the guest, e.g. "You'll get $224.54 back." */
  summary: string;
}

/**
 * When a guest stops being able to cancel for a full refund. For "pay now"
 * that's 24 hours after the trip was confirmed (booking time until then).
 */
export function freeCancellationUntil(
  trip: Pick<Trip, "rate_type" | "created_at" | "approved_at" | "starts_at">
): Date {
  const start = new Date(trip.starts_at);
  if (trip.rate_type === "refundable") return start;
  const grace = new Date(new Date(trip.approved_at ?? trip.created_at).getTime() + GRACE_MS);
  return grace < start ? grace : start;
}

export function guestCancellation(trip: CancellableTrip, now = new Date()): CancellationTerms {
  if (trip.status !== "pending" && trip.status !== "approved") {
    return { canCancel: false, refundCents: 0, summary: "This trip can't be cancelled." };
  }
  if (now >= new Date(trip.starts_at)) {
    return { canCancel: false, refundCents: 0, summary: "The trip has already started." };
  }
  if (trip.payment_status !== "captured") {
    return { canCancel: true, refundCents: 0, summary: "Nothing has been charged, so the hold on your card is released." };
  }
  if (now < freeCancellationUntil(trip)) {
    return { canCancel: true, refundCents: trip.total_cents, summary: "You'll get a full refund." };
  }
  return { canCancel: true, refundCents: 0, summary: "This booking is past free cancellation, so there's no refund." };
}
