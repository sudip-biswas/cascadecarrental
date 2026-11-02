import Link from "next/link";
import { Award, CalendarDays, ChevronDown, ChevronRight, Clock, MessageSquareText, Wrench } from "lucide-react";
import { TOP_HOST_BARS, type RateBar, type TopHostStanding } from "@/lib/top-host";
import { cn, pluralize } from "@/lib/utils";
import { Tag, Tile, TileTitle } from "@/components/kit";
import { percent, tagCounts } from "@/components/reviews/stats";

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

/** One rate bar as a row on the page. */
function rateMetric(
  key: string,
  label: string,
  bar: RateBar,
  target: number,
  hitLabel: string
): Pick<Metric, "key" | "label" | "value" | "target" | "met" | "counts"> {
  return {
    key,
    label,
    value: bar.share === null ? "–" : percent(bar.share, 1),
    target: percent(target),
    met: bar.met,
    counts: [
      { label: hitLabel, value: bar.hits },
      { label: "Ratings", value: bar.given },
    ],
  };
}

const TIPS = [
  { href: "/host/calendar", icon: CalendarDays, label: "Keep your calendar up to date" },
  { href: "/host/hours", icon: Clock, label: "Set pickup and return hours that work for you" },
  { href: "/host/business/ratings?category=maintenance", icon: Wrench, label: "See what guests flagged on your cars" },
  { href: "/host/inbox", icon: MessageSquareText, label: "Answer guests quickly, before and during trips" },
];

/** Where the host stands against the bars in lib/top-host.ts, one row each. */
export function TopHost({ standing }: { standing: TopHostStanding }) {
  const { rated, cancellation, trips, met, missing } = standing;
  const { cancelled, booked } = cancellation;
  const total = trips.completed;

  const maintenanceTags = tagCounts(rated, "maintenance").slice(0, 3);
  const cleanlinessTags = tagCounts(rated, "cleanliness").slice(0, 3);
  const flagged = (tags: typeof maintenanceTags) =>
    tags.length ? [`Guests flagged most: ${tags.map((t) => `${t.label.toLowerCase()} (${t.count})`).join(", ")}.`] : [];

  const fiveStar = rateMetric("five-star", "Five-star rate", standing.fiveStar, TOP_HOST_BARS.fiveStar, "Five-stars");
  const maintenance = rateMetric(
    "maintenance",
    "Maintenance rate",
    standing.maintenance,
    TOP_HOST_BARS.maintenance,
    "Five-star maintenance"
  );
  const cleanliness = rateMetric(
    "cleanliness",
    "Cleanliness rate",
    standing.cleanliness,
    TOP_HOST_BARS.cleanliness,
    "Five-star cleanliness"
  );

  const metrics: Metric[] = [
    {
      key: "cancellation",
      label: "Cancellation rate",
      value: percent(cancellation.share, 1),
      target: `${percent(TOP_HOST_BARS.cancellation)} or less`,
      met: cancellation.met,
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
      target: `${TOP_HOST_BARS.trips} or more`,
      met: trips.met,
      counts: [{ label: "Completed in the last year", value: total }],
      advice: [
        trips.met
          ? "Enough trips to qualify."
          : `${pluralize(TOP_HOST_BARS.trips - total, "more trip")} to go. Instant book and fair prices help cars get booked.`,
      ],
    },
  ];

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
              Guests see the tag after the daily check.
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
