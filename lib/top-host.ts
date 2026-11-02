import { createAdminClient } from "@/lib/supabase/admin";
import { allRows } from "@/lib/supabase/all-rows";
import type { Trip } from "@/lib/supabase/types";
import { CANCEL_REASON } from "@/lib/trip-status";
import { fiveStars, type RatingColumn, type ScoredReview } from "@/components/reviews/stats";

/** Top host is judged on the last year of trips. */
export const TOP_HOST_DAYS = 365;

export const TOP_HOST_BARS = {
  /** At most this share of booked trips cancelled by the host. */
  cancellation: 0.03,
  /** At least these shares of guest ratings at five stars. */
  fiveStar: 0.85,
  maintenance: 0.8,
  cleanliness: 0.8,
  /** At least this many finished trips. */
  trips: 20,
} as const;

/** The review columns the bars read. */
export const TOP_HOST_REVIEW_COLUMNS =
  "trip_id, rating_overall, rating_cleanliness, rating_maintenance, rating_communication, rating_convenience, rating_accuracy, issue_tags";

export type TopHostTrip = Pick<Trip, "id" | "status" | "cancellation_reason" | "starts_at" | "ends_at">;

export interface RateBar {
  hits: number;
  given: number;
  /** Null until someone has given this rating. */
  share: number | null;
  met: boolean;
}

export interface TopHostStanding {
  /** Guest ratings on the trips that count. */
  rated: ScoredReview[];
  cancellation: { cancelled: number; booked: number; share: number; met: boolean };
  fiveStar: RateBar;
  maintenance: RateBar;
  cleanliness: RateBar;
  trips: { completed: number; met: boolean };
  /** Bars not cleared yet. */
  missing: number;
  /** Every bar cleared. */
  met: boolean;
}

function rateBar(reviews: ScoredReview[], column: RatingColumn, target: number): RateBar {
  const given = reviews.filter((r) => r[column] != null).length;
  const hits = fiveStars(reviews, column);
  const share = given ? hits / given : null;
  return { hits, given, share, met: share !== null && share >= target };
}

const topHostSince = (now: Date) => new Date(now.getTime() - TOP_HOST_DAYS * 86_400_000);

/**
 * Turo's All-Star Host, as "Top host": five bars over the last year, all of
 * which have to be cleared. Rates are shares of the guest ratings given, so
 * trips nobody rated don't count either way. The performance page and the
 * tag guests see both come from here.
 */
export function topHostStanding(trips: TopHostTrip[], reviews: ScoredReview[], now: Date): TopHostStanding {
  const since = topHostSince(now).getTime();
  const completed = trips.filter((t) => t.status === "completed" && Date.parse(t.ends_at) >= since);
  const completedIds = new Set(completed.map((t) => t.id));
  const rated = reviews.filter((r) => completedIds.has(r.trip_id));
  const cancelled = trips.filter(
    (t) => t.status === "cancelled_host" && t.cancellation_reason === CANCEL_REASON.byHost && Date.parse(t.starts_at) >= since
  ).length;
  const booked = completed.length + cancelled;
  const share = booked ? cancelled / booked : 0;

  const bars = {
    cancellation: { cancelled, booked, share, met: share <= TOP_HOST_BARS.cancellation },
    fiveStar: rateBar(rated, "rating_overall", TOP_HOST_BARS.fiveStar),
    maintenance: rateBar(rated, "rating_maintenance", TOP_HOST_BARS.maintenance),
    cleanliness: rateBar(rated, "rating_cleanliness", TOP_HOST_BARS.cleanliness),
    trips: { completed: completed.length, met: completed.length >= TOP_HOST_BARS.trips },
  };
  const missing = Object.values(bars).filter((bar) => !bar.met).length;
  return { rated, ...bars, missing, met: missing === 0 };
}

type WindowTrip = TopHostTrip & { host_id: string; reviews: ScoredReview[] };

/**
 * Cron: stores who is a top host in profiles.top_host, for search and the car
 * and host pages. Any failed read throws before a write, so a bad day can't
 * take the tag away from everyone.
 */
export async function refreshTopHosts(now = new Date()) {
  const admin = createAdminClient();
  const since = topHostSince(now).toISOString();

  const rows = await allRows<WindowTrip>((from, to) =>
    admin
      .from("trips")
      .select(`id, host_id, status, cancellation_reason, starts_at, ends_at, reviews(${TOP_HOST_REVIEW_COLUMNS})`)
      .in("status", ["completed", "cancelled_host"])
      .or(`ends_at.gte.${since},starts_at.gte.${since}`)
      .eq("reviews.kind", "guest_to_host")
      .order("id")
      .range(from, to)
      .overrideTypes<WindowTrip[], { merge: false }>()
  );

  const byHost = new Map<string, WindowTrip[]>();
  for (const trip of rows) {
    const trips = byHost.get(trip.host_id);
    if (trips) trips.push(trip);
    else byHost.set(trip.host_id, [trip]);
  }
  const earned = new Set(
    [...byHost]
      .filter(([, trips]) => topHostStanding(trips, trips.flatMap((t) => t.reviews), now).met)
      .map(([hostId]) => hostId)
  );

  const { data: current, error } = await admin.from("profiles").select("id").eq("top_host", true);
  if (error) throw error;
  const had = new Set((current ?? []).map((p) => p.id));

  const set = async (ids: string[], top_host: boolean) => {
    if (!ids.length) return;
    const { error } = await admin.from("profiles").update({ top_host }).in("id", ids);
    if (error) throw error;
  };
  const gained = [...earned].filter((id) => !had.has(id));
  const lost = [...had].filter((id) => !earned.has(id));
  await set(gained, true);
  await set(lost, false);

  return { topHosts: earned.size, gained: gained.length, lost: lost.length };
}
