import type { Tone } from "@/components/kit";
import type { Trip } from "@/lib/supabase/types";

type StatusTrip = Pick<Trip, "status" | "payment_status">;

/** How a trip's state reads to the guest, the host or Cascade, with the fill colour for its label. */
export function tripStatus(trip: StatusTrip, viewer: "guest" | "host" | "admin"): { label: string; tone: Tone } {
  switch (trip.status) {
    case "pending":
      if (trip.payment_status !== "authorized") return { label: "Finishing payment", tone: "board" };
      return viewer === "host"
        ? { label: "Needs your answer", tone: "butter" }
        : { label: "Waiting for host", tone: "butter" };
    case "approved":
      return { label: "Confirmed", tone: "mint" };
    case "active":
      return { label: "On the road", tone: "sky" };
    case "completed":
      return { label: "Done", tone: "board" };
    case "cancelled_host":
      return { label: viewer === "host" ? "You cancelled" : "Cancelled by host", tone: "peach" };
    case "cancelled_guest":
      return { label: viewer === "guest" ? "You cancelled" : "Guest cancelled", tone: "peach" };
  }
}

/** Stored in trips.cancellation_reason. Pages match on these, so keep them in one place. */
export const CANCEL_REASON = {
  checkoutNotFinished: "Checkout not finished",
  paymentFailed: "Payment didn't go through",
  paymentCancelled: "Payment cancelled",
  declined: "Declined by the host",
  hostMissed: "The host didn't answer in time",
  byHost: "Cancelled by the host",
  byGuest: "Cancelled by the guest",
  refunded: "Refunded by Cascade",
} as const;

/** Checkouts that never got paid for. Nobody needs to see these in a list. */
export function isAbandoned(trip: StatusTrip & Pick<Trip, "cancellation_reason">) {
  return (
    trip.status === "cancelled_guest" &&
    (trip.payment_status === "pending" ||
      trip.payment_status === "failed" ||
      trip.cancellation_reason === CANCEL_REASON.checkoutNotFinished)
  );
}
