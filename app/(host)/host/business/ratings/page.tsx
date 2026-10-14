import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { tripDays } from "@/lib/pricing";
import { formatDate, pluralize } from "@/lib/utils";
import type { Review } from "@/lib/supabase/types";
import { EmptyState, PageTitle, Tile, TileTitle } from "@/components/kit";
import { Initial, firstName } from "@/components/host/bits";
import { ReplyForm } from "./ReplyForm";

export const instant = false;
export const metadata = { title: "Ratings" };

type ReviewRow = Pick<
  Review,
  | "id"
  | "created_at"
  | "reviewer_id"
  | "rating_overall"
  | "rating_cleanliness"
  | "rating_accuracy"
  | "rating_value"
  | "body"
  | "host_reply"
> & {
  reviewer: { full_name: string | null } | null;
  trips: { starts_at: string; ends_at: string } | null;
  vehicles: { make: string; model: string } | null;
};

function average(values: (number | null)[]): number | null {
  const set = values.filter((v): v is number => v !== null);
  return set.length ? set.reduce((a, b) => a + b, 0) / set.length : null;
}

function Stars({ value, size = 26 }: { value: number; size?: number }) {
  return (
    <span className="flex gap-1" role="img" aria-label={`${value.toFixed(1)} out of 5`}>
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

export default async function RatingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/business/ratings");

  const [{ data }, { count: carCount }] = await Promise.all([
    supabase
      .from("reviews")
      .select(
        "id, created_at, reviewer_id, rating_overall, rating_cleanliness, rating_accuracy, rating_value, body, host_reply, reviewer:profiles!reviewer_id(full_name), trips(starts_at, ends_at), vehicles(make, model)"
      )
      .eq("reviewee_id", user.id)
      .order("created_at", { ascending: false })
      .overrideTypes<ReviewRow[], { merge: false }>(),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("host_id", user.id),
  ]);
  const reviews = data ?? [];

  if (reviews.length === 0) {
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

  const overall = average(reviews.map((r) => r.rating_overall)) ?? 0;
  const parts = [
    { label: "Clean", value: average(reviews.map((r) => r.rating_cleanliness)) },
    { label: "As described", value: average(reviews.map((r) => r.rating_accuracy)) },
    { label: "Value", value: average(reviews.map((r) => r.rating_value)) },
  ].filter((p): p is { label: string; value: number } => p.value !== null);
  const multipleCars = (carCount ?? 0) > 1;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <PageTitle title="Ratings" />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
        <Tile tone="butter" className="flex flex-col gap-2.5 sm:p-[26px]">
          <span className="text-[15px] font-semibold">{multipleCars ? "Your cars' rating" : "Your car's rating"}</span>
          <span className="flex flex-wrap items-baseline gap-3">
            <span className="font-display text-[72px] leading-none font-extrabold tracking-[-0.03em] text-ink sm:text-[96px]">
              {overall.toFixed(1)}
            </span>
            <span className="text-base">from {pluralize(reviews.length, "review")}</span>
          </span>
          <Stars value={overall} />
        </Tile>

        {parts.length > 0 && (
          <Tile className="figures flex flex-col justify-center gap-3.5 sm:p-[26px]">
            {parts.map((p) => (
              <div key={p.label} className="grid grid-cols-[110px_1fr_36px] items-center gap-3 text-[15px]">
                <span className="font-semibold">{p.label}</span>
                <span className="h-3 overflow-hidden rounded-[6px] bg-line">
                  <span className="block h-full rounded-[6px] bg-ink" style={{ width: `${(p.value / 5) * 100}%` }} />
                </span>
                <span className="text-right font-extrabold">{p.value.toFixed(1)}</span>
              </div>
            ))}
          </Tile>
        )}
      </div>

      <Tile className="flex flex-col gap-4 sm:p-6">
        <TileTitle>What guests said</TileTitle>
        {reviews.map((r) => {
          const name = firstName(r.reviewer?.full_name);
          const context = r.trips
            ? `${pluralize(tripDays(r.trips.starts_at, r.trips.ends_at), "day")} in ${formatDate(r.trips.starts_at, {
                month: "long",
                day: undefined,
                year: undefined,
              })}`
            : formatDate(r.created_at);
          return (
            <article key={r.id} className="flex flex-col gap-3 rounded-[22px] bg-board p-[18px]">
              <div className="flex items-center gap-3">
                <Initial name={name} seed={r.reviewer_id} className="size-11 rounded-[14px] text-[18px]" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-base font-extrabold">
                    {name} · ★ {r.rating_overall}
                  </span>
                  <span className="text-sm text-slate">
                    {multipleCars && r.vehicles ? `${r.vehicles.make} ${r.vehicles.model} · ` : ""}
                    {context}
                  </span>
                </span>
              </div>
              {r.body && <p className="text-[17px] leading-normal">&ldquo;{r.body}&rdquo;</p>}
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
      </Tile>
    </div>
  );
}
