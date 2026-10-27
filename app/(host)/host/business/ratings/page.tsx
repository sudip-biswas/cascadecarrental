import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDate, pluralize } from "@/lib/utils";
import type { Review } from "@/lib/supabase/types";
import { EmptyState, PageTitle, Tag, Tile, TileTitle } from "@/components/kit";
import { Initial, firstName } from "@/components/host/bits";
import { CATEGORY_BY_KEY, ISSUE_TAGS, averageOf, type CategoryKey } from "@/components/reviews/categories";
import { RatingsFilters } from "@/components/reviews/RatingsFilters";
import { columnFor, fiveStars, percent, tagCounts } from "@/components/reviews/stats";
import { ReplyForm } from "./ReplyForm";

export const instant = false;
export const metadata = { title: "Ratings" };

type ReviewRow = Pick<
  Review,
  | "id"
  | "created_at"
  | "trip_id"
  | "vehicle_id"
  | "reviewer_id"
  | "rating_overall"
  | "rating_cleanliness"
  | "rating_maintenance"
  | "rating_communication"
  | "rating_convenience"
  | "rating_accuracy"
  | "issue_tags"
  | "body"
  | "host_reply"
> & { reviewer: { full_name: string | null } | null };

type CarRow = { id: string; make: string; model: string; year: number };

/** Reviews listed before "Show all". */
const PAGE = 20;

const PERIODS = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 365 days" },
  { value: "all", label: "All time" },
];

// Turo's order on this page: the categories hosts most often lose stars on first.
const CARD_ORDER: CategoryKey[] = ["maintenance", "cleanliness", "accuracy", "communication", "convenience"];

function Stars({ value, size = 18 }: { value: number; size?: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          strokeWidth={0}
          className={i < Math.round(value) ? "fill-ink" : "fill-ink/15"}
        />
      ))}
    </span>
  );
}

function carName(car: CarRow | undefined) {
  return car ? `${car.make} ${car.model} ${car.year}` : "";
}

export default async function RatingsPage({ searchParams }: PageProps<"/host/business/ratings">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/business/ratings");

  const [params, { data: carsData }, { data: tripsData }, { data: reviewsData }] = await Promise.all([
    searchParams,
    supabase.from("vehicles").select("id, make, model, year").eq("host_id", user.id).order("created_at"),
    supabase.from("trips").select("id, vehicle_id, ends_at").eq("host_id", user.id).eq("status", "completed"),
    supabase
      .from("reviews")
      .select(
        "id, created_at, trip_id, vehicle_id, reviewer_id, rating_overall, rating_cleanliness, rating_maintenance, rating_communication, rating_convenience, rating_accuracy, issue_tags, body, host_reply, reviewer:profiles!reviewer_id(full_name)"
      )
      .eq("reviewee_id", user.id)
      .eq("kind", "guest_to_host")
      .order("created_at", { ascending: false })
      .overrideTypes<ReviewRow[], { merge: false }>(),
  ]);
  const cars = (carsData ?? []) as CarRow[];
  const carsById = new Map(cars.map((c) => [c.id, c]));

  if (!reviewsData?.length) {
    return (
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
        <PageTitle title="Ratings" />
        <EmptyState
          icon={<Star />}
          title="No reviews yet"
          body="Guests can review a trip once it's over. Their ratings and comments show up here, and you can reply."
        />
      </div>
    );
  }

  // Filters live in the URL. Unknown values fall back to the defaults.
  const pick = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  const carId = carsById.has(pick(params.car) ?? "") ? pick(params.car)! : null;
  const period = PERIODS.find((p) => p.value === pick(params.period))?.value ?? "365";
  const categoryParam = pick(params.category);
  const category: CategoryKey | "overall" =
    categoryParam && categoryParam in CATEGORY_BY_KEY ? (categoryParam as CategoryKey) : "overall";
  const column = columnFor(category);
  const categoryLabel = category === "overall" ? "Overall" : CATEGORY_BY_KEY[category].label;

  // Everything counts by when the trip ended, so a trip and its review land in the same period.
  const since = period === "all" ? null : new Date(new Date().getTime() - Number(period) * 86_400_000).toISOString();
  const trips = (tripsData ?? []).filter((t) => (!carId || t.vehicle_id === carId) && (!since || t.ends_at >= since));
  const tripEnds = new Map(trips.map((t) => [t.id, t.ends_at]));
  const reviews = reviewsData.filter((r) => tripEnds.has(r.trip_id));
  const tripCount = Math.max(trips.length, reviews.length);

  // Star shares are of the ratings given. Unrated is the share of trips nobody
  // rated, kept apart so quiet guests don't drag the five-star share down.
  const rated = reviews.filter((r) => r[column] != null);
  const distribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = rated.filter((r) => r[column] === stars).length;
    return { label: pluralize(stars, "star"), share: rated.length ? count / rated.length : 0 };
  });
  const unrated = tripCount ? (tripCount - rated.length) / tripCount : 0;
  const average = averageOf(rated.map((r) => r[column]));
  const fiveStarShare = (key: CategoryKey | "overall") => {
    const col = columnFor(key);
    const given = reviews.filter((r) => r[col] != null).length;
    return given ? fiveStars(reviews, col) / given : null;
  };
  const headline = fiveStarShare(category);

  const listed = category === "overall" ? reviews : rated;
  const showAll = pick(params.show) === "all";
  const shown = showAll ? listed : listed.slice(0, PAGE);
  const multipleCars = cars.length > 1;
  const href = (key: CategoryKey | "overall", all = false) => {
    const next = new URLSearchParams();
    if (carId) next.set("car", carId);
    if (period !== "365") next.set("period", period);
    if (key !== "overall") next.set("category", key);
    if (all) next.set("show", "all");
    const qs = next.toString();
    return qs ? `/host/business/ratings?${qs}` : "/host/business/ratings";
  };

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <PageTitle
        title="Ratings"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Suspense>
              <RatingsFilters
                filters={[
                  ...(multipleCars
                    ? [
                        {
                          name: "car",
                          label: "Car",
                          fallback: "all",
                          options: [{ value: "all", label: "All cars" }, ...cars.map((c) => ({ value: c.id, label: carName(c) }))],
                        },
                      ]
                    : []),
                  { name: "period", label: "Period", fallback: "365", options: PERIODS },
                  {
                    name: "category",
                    label: "Category",
                    fallback: "overall",
                    options: [
                      { value: "overall", label: "Overall" },
                      ...CARD_ORDER.map((k) => ({ value: k, label: CATEGORY_BY_KEY[k].label })),
                    ],
                  },
                ]}
              />
            </Suspense>
          </div>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col gap-4">
          <Tile tone="butter" className="figures flex flex-col gap-4 sm:p-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3">
                <TileTitle>{categoryLabel}</TileTitle>
                <span className="font-display text-[28px] font-extrabold">
                  {headline === null ? "–" : percent(headline)}
                </span>
              </div>
              <span className="text-sm">Share of guest ratings that were five stars.</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {[...distribution, { label: "Unrated", share: unrated }].map((d) => (
                <div
                  key={d.label}
                  className={cn(
                    "grid grid-cols-[72px_1fr_44px] items-center gap-3 text-[15px]",
                    d.label === "Unrated" && "mt-1 border-t-2 border-ink/10 pt-3.5"
                  )}
                >
                  <span className="font-semibold">{d.label}</span>
                  <span className="h-2.5 overflow-hidden rounded-[5px] bg-white">
                    <span
                      className={cn("block h-full rounded-[5px]", d.label === "Unrated" ? "bg-ink/40" : "bg-ink")}
                      style={{ width: `${d.share * 100}%` }}
                    />
                  </span>
                  <span className="text-right font-bold">{percent(d.share)}</span>
                </div>
              ))}
              <span className="text-[13px]">Unrated is the share of trips the guest didn&apos;t rate.</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Trips", value: String(tripCount) },
                { label: "Ratings", value: String(rated.length) },
                { label: "Average", value: average === null ? "–" : `${average.toFixed(1)} ★` },
              ].map((f) => (
                <div key={f.label} className="flex flex-col gap-0.5 rounded-[14px] bg-white px-3 py-2.5">
                  <span className="text-[12px] font-semibold text-slate">{f.label}</span>
                  <span className="text-[20px] font-extrabold">{f.value}</span>
                </div>
              ))}
            </div>
          </Tile>

          {CARD_ORDER.map((key) => {
            const c = CATEGORY_BY_KEY[key];
            const tags = tagCounts(reviews, key);
            const share = fiveStarShare(key);
            return (
              <Tile key={key} className={cn("flex flex-col gap-3", category === key && "ring-2 ring-ink")}>
                <Link
                  href={href(category === key ? "overall" : key)}
                  scroll={false}
                  className="flex items-baseline justify-between gap-3 hover:underline"
                >
                  <span className="text-[19px] font-extrabold">{c.label}</span>
                  <span className="figures text-[19px] font-extrabold">{share === null ? "–" : percent(share)}</span>
                </Link>
                {tags.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <Tag key={t.id} className="px-2.5 py-1.5 text-[13px]">
                        {t.label} ({t.count})
                      </Tag>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-slate">No issues flagged.</span>
                )}
              </Tile>
            );
          })}
        </div>

        <Tile className="flex flex-col gap-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <TileTitle>Reviews ({listed.length})</TileTitle>
            <span className="text-sm text-slate">
              {categoryLabel} rating · most recent first
            </span>
          </div>
          {listed.length === 0 && <p className="text-[15px] text-slate">No reviews in this period.</p>}
          {shown.map((r) => {
            const name = firstName(r.reviewer?.full_name);
            const stars = r[column] ?? r.rating_overall;
            const tags = (r.issue_tags ?? []).flatMap((id) => {
              const tag = ISSUE_TAGS.get(id);
              return tag && (category === "overall" || tag.category === category) ? [{ id, label: tag.label }] : [];
            });
            return (
              <article key={r.id} className="flex flex-col gap-3 rounded-[22px] bg-board p-[18px]">
                <div className="flex items-center gap-3">
                  <Initial name={name} seed={r.reviewer_id} className="size-11 rounded-[14px] text-[18px]" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <Stars value={stars} />
                    <span className="text-sm text-slate">
                      <span className="font-bold text-ink">{name}</span> · {formatDate(r.created_at)}
                    </span>
                  </span>
                </div>
                {multipleCars && <span className="text-sm font-semibold">{carName(carsById.get(r.vehicle_id))}</span>}
                {r.body && <p className="text-[17px] leading-normal">&ldquo;{r.body}&rdquo;</p>}
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <Tag key={t.id} tone="white" className="px-2.5 py-1.5">
                        {t.label}
                      </Tag>
                    ))}
                  </div>
                )}
                {r.host_reply ? (
                  <div className="rounded-2xl bg-white px-3.5 py-3 text-[15px]">
                    <span className="font-extrabold">You replied:</span> {r.host_reply}
                  </div>
                ) : (
                  <ReplyForm reviewId={r.id} guestName={name} />
                )}
              </article>
            );
          })}
          {shown.length < listed.length && (
            <Link
              href={href(category, true)}
              scroll={false}
              className="self-center rounded-[12px] bg-board px-4 py-2.5 text-[15px] font-bold transition-colors hover:bg-line"
            >
              Show all {listed.length} reviews
            </Link>
          )}
        </Tile>
      </div>
    </div>
  );
}
