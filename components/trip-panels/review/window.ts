import type { Trip } from "@/lib/supabase/types";

/** Hosts have this long after a trip ends to review the guest. */
export const HOST_REVIEW_DAYS = 14;

/** When the host can no longer review the guest. */
export function hostReviewCloses(trip: Pick<Trip, "ends_at" | "completed_at">): Date {
  const ended = new Date(trip.completed_at ?? trip.ends_at);
  return new Date(ended.getTime() + HOST_REVIEW_DAYS * 86_400_000);
}

/**
 * Host reviews reuse the guest review's columns, so the extra stars mean
 * something else depending on who wrote them.
 */
export const HOST_RATING_LABELS = {
  rating_cleanliness: "Returned clean",
  rating_accuracy: "On time",
  rating_value: "Followed the rules",
} as const;

export const GUEST_RATING_LABELS = {
  rating_cleanliness: "Clean",
  rating_accuracy: "As described",
  rating_value: "Worth the price",
} as const;
