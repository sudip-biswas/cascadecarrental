import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { settleTripStatuses } from "@/lib/trips";
import { cn, formatCurrency, formatPrice, formatRange } from "@/lib/utils";
import { EmptyState, PageTitle, Tag } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { firstName, Initial } from "@/components/host/bits";
import { HistoryFilters } from "@/components/host/HistoryFilters";
import { loadHistory } from "@/components/host/history";

export const instant = false;
export const metadata = { title: "Trip history" };

const COLUMNS = "grid-cols-[1.4fr_1fr_1.2fr_1.2fr_0.8fr_0.6fr]";

export default async function HostHistoryPage({ searchParams }: PageProps<"/host/trips/history">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/trips/history");

  await settleTripStatuses(user.id);
  const params = await searchParams;
  const filter = {
    car: typeof params.car === "string" ? params.car : undefined,
    year: typeof params.year === "string" ? params.year : undefined,
  };
  const { rows, cars, years } = await loadHistory(supabase, user.id, filter);

  const completed = rows.filter((r) => r.trip.status === "completed").length;
  const cancelled = rows.length - completed;
  const earned = rows.reduce((sum, r) => sum + r.earnedCents, 0);
  const csv = new URLSearchParams(Object.entries(filter).filter((e): e is [string, string] => Boolean(e[1])));

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/host/trips"
        className="flex items-center gap-2 self-start rounded-[12px] bg-white px-3.5 py-2.5 text-[15px] font-bold transition-colors hover:bg-line"
      >
        <ArrowLeft className="size-[18px]" /> Trips
      </Link>
      <PageTitle
        title="History"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Suspense>
              <HistoryFilters cars={cars} years={years} />
            </Suspense>
            {rows.length > 0 && (
              <Button asChild size="sm" className="h-10 text-[15px]">
                <a href={`/host/trips/history/csv${csv.size ? `?${csv}` : ""}`} download>
                  <Download /> Export CSV
                </a>
              </Button>
            )}
          </div>
        }
      />

      <div className="figures grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3">
        <div className="rounded-[26px] bg-mint p-5">
          <p className="text-sm font-semibold text-mint-ink">Completed trips</p>
          <p className="font-display text-[52px] leading-tight font-extrabold">{completed}</p>
        </div>
        <div className="rounded-[26px] bg-peach p-5">
          <p className="text-sm font-semibold text-peach-ink">Earned, not yet paid out</p>
          <p className="font-display text-[52px] leading-tight font-extrabold">{formatPrice(earned)}</p>
        </div>
        <div className="rounded-[26px] bg-white p-5">
          <p className="text-sm font-semibold text-slate">Cancelled</p>
          <p className="font-display text-[52px] leading-tight font-extrabold">{cancelled}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={filter.car || filter.year ? "No trips match" : "No past trips yet"}
          body="Finished and cancelled trips land here once they're over."
        />
      ) : (
        <section className="overflow-x-auto rounded-[30px] bg-white p-2.5">
          <div className="figures flex min-w-[760px] flex-col">
            <div className={cn("grid gap-3 px-3.5 py-3 text-[13px] font-bold text-slate", COLUMNS)}>
              <span>Guest</span>
              <span>Car</span>
              <span>Dates</span>
              <span>Status</span>
              <span className="text-right">Earned</span>
              <span className="text-right">Review</span>
            </div>
            {rows.map(({ trip, status, earnedCents, rating }, i) => {
              const guest = firstName(trip.guest?.full_name);
              return (
                <div
                  key={trip.id}
                  className={cn(
                    "grid items-center gap-3 rounded-[16px] p-3.5 text-[15px]",
                    COLUMNS,
                    i % 2 === 0 && "bg-board"
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2.5 font-bold">
                    <Initial name={guest} seed={trip.guest_id} className="size-8 rounded-[10px] text-[15px]" />
                    <span className="truncate">{guest}</span>
                  </span>
                  <span className="truncate">{trip.vehicle?.model ?? "Car"}</span>
                  <span>{formatRange(trip.starts_at, trip.ends_at)}</span>
                  <span>
                    <Tag tone={trip.status === "completed" ? "mint" : "peach"}>
                      {trip.status === "completed" ? "Completed" : status.label}
                    </Tag>
                  </span>
                  <span className="text-right font-bold">{formatCurrency(earnedCents)}</span>
                  <span className={cn("text-right", !rating && "text-slate")}>{rating ? `★ ${rating}` : "–"}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <p className="text-sm text-slate">
        Earnings are 80% of each trip&apos;s rental price. Payouts aren&apos;t set up yet, so nothing has been paid out.
      </p>
    </div>
  );
}
