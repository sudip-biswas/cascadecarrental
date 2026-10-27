import Link from "next/link";
import { Award, CalendarDays, ChevronDown, ChevronRight, Clock, MessageSquareText, Wrench } from "lucide-react";
import { CANCEL_REASON } from "@/lib/trip-status";
import { cn, formatDate, pluralize, toDateKey, zonedInstant } from "@/lib/utils";
import { Tag, Tile, TileTitle } from "@/components/kit";
import { fiveStars, percent, tagCounts, type RatingColumn, type ScoredReview } from "@/components/reviews/stats";
import type { HostTripRow } from "../_lib/trips";

/** Top host is judged on the last year of trips. */
export const TOP_HOST_DAYS = 365;

type Metric = {
  key: string;
  label: string;
  /** Shown in the pill, e.g. "62.8%" or "14". */
  value: string;
  target: string;
  met: boolean;
  counts: { label: string; value: number }[];
  advice: string[];
  /** Where to dig in, e.g. the ratings page filtered to this category. */
  link?: { href: string; label: string };
};

/** Status is checked at the start of each quarter. */
function nextCheck(now: Date): Date {
  const [year, month] = toDateKey(now).split("-").map(Number);
  const quarter = Math.floor((month - 1) / 3);
  const next = quarter === 3 ? `${year + 1}-01-01` : `${year}-${String(quarter * 3 + 4).padStart(2, "0")}-01`;
  return zonedInstant(next, "00:00");
}

/** Share of the guest ratings for a column that were five stars. */
function rateMetric(
  key: string,
  label: string,
  reviews: ScoredReview[],
  column: RatingColumn,
  target: number,
  hitLabel: string
): Pick<Metric, "key" | "label" | "value" | "target" | "met" | "counts"> {
  const given = reviews.filter((r) => r[column] != null).length;
  const hits = fiveStars(reviews, column);
  const share = given ? hits / given : null;
  return {
    key,
    label,
    value: share === null ? "–" : percent(share, 1),
    target: percent(target),
    met: share !== null && share >= target,
    counts: [
      { label: hitLabel, value: hits },
      { label: "Ratings", value: given },
    ],
  };
}

const TIPS = [
  { href: "/host/calendar", icon: CalendarDays, label: "Keep your calendar up to date" },
  { href: "/host/hours", icon: Clock, label: "Set pickup and return hours that work for you" },
  { href: "/host/business/ratings?category=maintenance", icon: Wrench, label: "See what guests flagged on your cars" },
  { href: "/host/inbox", icon: MessageSquareText, label: "Answer guests quickly, before and during trips" },
];

/**
 * Turo's All-Star Host, as "Top host": five bars over the last year, all of
 * which have to be cleared. Rates are shares of the guest ratings given, so
 * trips nobody rated don't count either way.
 */
export function TopHost({ trips, reviews, now }: { trips: HostTripRow[]; reviews: ScoredReview[]; now: Date }) {
  const since = new Date(now.getTime() - TOP_HOST_DAYS * 86_400_000).toISOString();
  const completed = trips.filter((t) => t.status === "completed" && t.ends_at >= since);
  const completedIds = new Set(completed.map((t) => t.id));
  const rated = reviews.filter((r) => completedIds.has(r.trip_id));
  const cancelled = trips.filter(
    (t) => t.status === "cancelled_host" && t.cancellation_reason === CANCEL_REASON.byHost && t.starts_at >= since
  ).length;
  const booked = completed.length + cancelled;
  const total = completed.length;

  const cancelShare = booked ? cancelled / booked : 0;
  const maintenanceTags = tagCounts(rated, "maintenance").slice(0, 3);
  const cleanlinessTags = tagCounts(rated, "cleanliness").slice(0, 3);
  const flagged = (tags: typeof maintenanceTags) =>
    tags.length ? [`Guests flagged most: ${tags.map((t) => `${t.label.toLowerCase()} (${t.count})`).join(", ")}.`] : [];

  const fiveStar = rateMetric("five-star", "Five-star rate", rated, "rating_overall", 0.85, "Five-stars");
  const maintenance = rateMetric(
    "maintenance",
    "Maintenance rate",
    rated,
    "rating_maintenance",
    0.8,
    "Five-star maintenance"
  );
  const cleanliness = rateMetric(
    "cleanliness",
    "Cleanliness rate",
    rated,
    "rating_cleanliness",
    0.8,
    "Five-star cleanliness"
  );

  const metrics: Metric[] = [
    {
      key: "cancellation",
      label: "Cancellation rate",
      value: percent(cancelShare, 1),
      target: "3% or less",
      met: cancelShare <= 0.03,
      counts: [
        { label: "Cancelled by you", value: cancelled },
        { label: "Booked trips", value: booked },
      ],
      advice: [
        cancelled
          ? "Every cancellation leaves a guest stuck. Block days you can't host so they can't be booked."
          : "No cancellations. Keep blocking days you can't host so it stays that way.",
      ],
      link: { href: "/host/calendar", label: "Open your calendar" },
    },
    {
      ...fiveStar,
      advice: fiveStar.met
        ? ["Guests are happy. Keep doing what you're doing."]
        : [
            "Guests want well-kept, clean cars and a host who answers quickly.",
            "Rating your guests after each trip reminds them to rate theirs.",
          ],
      link: { href: "/host/business/ratings", label: "See your ratings" },
    },
    {
      ...maintenance,
      advice: [
        ...flagged(maintenanceTags),
        maintenance.met
          ? "Your cars are in good shape. Keep checking them between trips."
          : "Check tire pressure, oil and warning lights between trips, and fix chips before they spread.",
      ],
      link: { href: "/host/business/ratings?category=maintenance", label: "See maintenance reviews" },
    },
    {
      ...cleanliness,
      advice: [
        ...flagged(cleanlinessTags),
        cleanliness.met
          ? "Guests find your cars clean. Keep the same routine."
          : "Vacuum, wipe down and clear out every car between trips. Guests notice the inside first.",
      ],
      link: { href: "/host/business/ratings?category=cleanliness", label: "See cleanliness reviews" },
    },
    {
      key: "trips",
      label: "Completed trips",
      value: String(total),
      target: "20 or more",
      met: total >= 20,
      counts: [{ label: "Completed in the last year", value: total }],
      advice: [
        total >= 20
          ? "Enough trips to qualify."
          : `${pluralize(20 - total, "more trip")} to go. Instant book and fair prices help cars get booked.`,
      ],
    },
  ];
  const met = metrics.every((m) => m.met);
  const missing = metrics.filter((m) => !m.met).length;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-3">
        <Tile tone={met ? "mint" : "white"} className="flex flex-wrap items-center gap-4 sm:p-6">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-[20px] bg-butter text-butter-ink">
            <Award className="size-8" strokeWidth={1.75} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex flex-wrap items-center gap-2">
              <TileTitle>Top host</TileTitle>
              <Tag tone={met ? "ink" : "peach"}>{met ? "Met" : "Not met"}</Tag>
            </span>
            <span className="text-[15px] text-slate">
              {met
                ? "You clear every bar. Keep it up."
                : `Clear all five bars over the last year to earn it. ${missing === 1 ? "One to go." : `${missing} to go.`}`}{" "}
              Next check is {formatDate(nextCheck(now), { year: undefined })}.
            </span>
          </span>
        </Tile>

        {metrics.map((m) => (
          <details key={m.key} className="group rounded-[22px] bg-white" open={!m.met && m.key === "five-star"}>
            <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
              <span className="flex-1 text-[17px] font-extrabold">{m.label}</span>
              <span className="flex flex-col items-end gap-1">
                <span
                  className={cn(
                    "figures rounded-[8px] px-2.5 py-1 text-[15px] font-extrabold",
                    m.met ? "bg-mint text-mint-ink" : "bg-peach text-peach-ink"
                  )}
                >
                  {m.value}
                </span>
                <span className="text-[12px] font-semibold text-slate">Top host: {m.target}</span>
              </span>
              <ChevronDown className="size-5 shrink-0 text-slate transition-transform group-open:rotate-180" />
            </summary>
            <div className="flex flex-col gap-3 px-5 pb-5">
              <div className="figures flex flex-wrap gap-2">
                {m.counts.map((c) => (
                  <span key={c.label} className="flex flex-col gap-0.5 rounded-[14px] bg-board px-3 py-2.5">
                    <span className="text-[12px] font-semibold text-slate">{c.label}</span>
                    <span className="text-[20px] font-extrabold">{c.value}</span>
                  </span>
                ))}
              </div>
              {m.advice.map((line) => (
                <p key={line} className="text-[15px]">
                  {line}
                </p>
              ))}
              {m.link && (
                <Link href={m.link.href} className="self-start text-[15px] font-bold underline underline-offset-4">
                  {m.link.label}
                </Link>
              )}
            </div>
          </details>
        ))}
      </div>

      <Tile tone="butter" className="flex flex-col gap-3 sm:p-6">
        <TileTitle>Tips</TileTitle>
        <p className="text-[15px]">Top hosts are ready, quick to reply and keep their cars spotless.</p>
        {TIPS.map((tip) => (
          <Link
            key={tip.href}
            href={tip.href}
            className="flex items-center gap-3 rounded-[16px] bg-white px-3.5 py-3 text-[15px] font-bold transition-colors hover:bg-line"
          >
            <tip.icon className="size-5 shrink-0" strokeWidth={1.75} />
            <span className="flex-1">{tip.label}</span>
            <ChevronRight className="size-4 shrink-0 text-slate" />
          </Link>
        ))}
      </Tile>
    </div>
  );
}
