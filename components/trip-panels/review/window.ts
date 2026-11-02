import type { Trip } from "@/lib/supabase/types";

/** Hosts have this long after a trip ends to review the guest. */
export const HOST_REVIEW_DAYS = 14;

/** When the host can no longer review the guest. */
export function hostReviewCloses(trip: Pick<Trip, "ends_at" | "completed_at">): Date {
  const ended = new Date(trip.completed_at ?? trip.ends_at);
  return new Date(ended.getTime() + HOST_REVIEW_DAYS * 86_400_000);
}

const DAY_MS = 86_400_000;

/** Whole days until reviews close, to the nearest day: 0 once they have, 1 on the last day. */
export function hostReviewDaysLeft(trip: Pick<Trip, "ends_at" | "completed_at">, now = new Date()): number {
  const left = hostReviewCloses(trip).getTime() - now.getTime();
  return left <= 0 ? 0 : Math.max(1, Math.round(left / DAY_MS));
}

/**
 * The reminder a trip is due, about 7 days or about 1 day before reviews close.
 * The daily tick always lands in the half-day either side of each mark, and a
 * missed tick is caught up by the next one, up to the deadline.
 */
export function hostReviewReminder(trip: Pick<Trip, "ends_at" | "completed_at">, now = new Date()): "7" | "1" | null {
  const days = (hostReviewCloses(trip).getTime() - now.getTime()) / DAY_MS;
  if (days <= 0 || days >= 7.5) return null;
  return days < 1.5 ? "1" : "7";
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

// Turo's five categories. Older reviews may carry rating_value instead.
export const GUEST_RATING_LABELS = {
  rating_cleanliness: "Cleanliness",
  rating_maintenance: "Maintenance",
  rating_communication: "Communication",
  rating_convenience: "Convenience",
  rating_accuracy: "Accuracy",
  rating_value: "Worth the price",
} as const;
