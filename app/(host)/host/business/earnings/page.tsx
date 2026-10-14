import { redirect } from "next/navigation";
import { Landmark } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { settleTripStatuses } from "@/lib/trips";
import { HOST_SHARE, hostEarningsCents } from "@/lib/pricing";
import { formatCurrency, formatDate, formatDateShort, toDateKey, zonedInstant } from "@/lib/utils";
import { EmptyState, PageTitle, Tag, Tile, TileTitle, toneClass, type Tone } from "@/components/kit";
import { EarningsChart, type MonthEarnings } from "@/components/host/EarningsChart";
import { firstName } from "@/components/host/bits";
import { hostTrips, isOpenRequest, isPaidTrip, type HostTripRow } from "../_lib/trips";

export const instant = false;
export const metadata = { title: "Earnings" };

const MONTHS_SHOWN = 6;

/** "2026-10" keys for the last few months, oldest first, in Pacific time. */
function recentMonths(now: Date, count: number): string[] {
  const [year, month] = toDateKey(now).split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 1 - (count - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}

const monthLabel = (key: string) =>
  formatDate(zonedInstant(`${key}-15`), { month: "short", day: undefined, year: undefined });

function rowStatus(t: HostTripRow): { label: string; tone: Tone } {
  if (isOpenRequest(t)) return { label: "Waiting on you", tone: "butter" };
  if (t.status === "completed") return { label: "Earned", tone: "mint" };
  return { label: "Booked", tone: "sky" };
}

export default async function EarningsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/business/earnings");

  await settleTripStatuses(user.id);
  const trips = await hostTrips(user.id);

  const now = new Date();
  const thisYear = toDateKey(now).slice(0, 4);
  const paid = trips.filter(isPaidTrip);
  const requests = trips.filter(isOpenRequest);
  const earn = (list: HostTripRow[]) => list.reduce((sum, t) => sum + hostEarningsCents(t.subtotal_cents), 0);

  const earnedThisYear = earn(paid.filter((t) => t.status === "completed" && toDateKey(t.ends_at).startsWith(thisYear)));
  const bookedAhead = earn(paid.filter((t) => t.status !== "completed"));
  const average = paid.length ? Math.round(earn(paid) / paid.length) : 0;
  const ifAccepted = earn(requests);

  const months = recentMonths(now, MONTHS_SHOWN);
  const chart: MonthEarnings[] = months.map((key) => {
    const inMonth = paid.filter((t) => toDateKey(t.ends_at).startsWith(key));
    return {
      month: monthLabel(key),
      earned: earn(inMonth.filter((t) => t.status === "completed")),
      booked: earn(inMonth.filter((t) => t.status !== "completed")),
    };
  });
  const hasChartData = chart.some((m) => m.earned > 0 || m.booked > 0);

  const rows = [...requests, ...paid].sort((a, b) => b.ends_at.localeCompare(a.ends_at)).slice(0, 12);

  const stats: { label: string; value: string; tone: Tone; show: boolean }[] = [
    { label: `Earned in ${thisYear}`, value: formatCurrency(earnedThisYear), tone: "peach", show: true },
    { label: "Booked, not finished yet", value: formatCurrency(bookedAhead), tone: "butter", show: true },
    { label: "If you accept your requests", value: formatCurrency(ifAccepted), tone: "lilac", show: ifAccepted > 0 },
    { label: "Average per trip", value: average ? formatCurrency(average) : "–", tone: "white", show: true },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <PageTitle title="Earnings" />

      <Tile tone="ink" className="flex flex-wrap items-center gap-[18px]">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[17px] bg-butter text-ink">
          <Landmark className="size-[26px]" strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
          <span className="font-display text-[22px] leading-tight font-extrabold sm:text-[26px]">
            Payouts aren&apos;t set up yet
          </span>
          <span className="text-[15px] text-[#c9ccd3]">
            Guests pay Cascade through Stripe. Bank payouts to hosts aren&apos;t switched on yet, so everything you
            earn is tracked here until they are. You keep {Math.round(HOST_SHARE * 100)}% of each trip&apos;s price;
            tax and protection aren&apos;t part of it.
          </span>
        </span>
      </Tile>

      <div className="figures grid grid-cols-[repeat(auto-fit,minmax(210px,1fr))] gap-3">
        {stats
          .filter((s) => s.show)
          .map((s) => (
            <div key={s.label} className={`rounded-[26px] p-5 ${toneClass[s.tone]}`}>
              <div className="text-sm font-semibold opacity-80">{s.label}</div>
              <div className="font-display text-[40px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[52px]">
                {s.value}
              </div>
            </div>
          ))}
      </div>

      {trips.length === 0 ? (
        <EmptyState
          title="No trips yet"
          body="Once guests book your cars, what you earn from each trip shows up here."
        />
      ) : (
        <>
          <Tile className="flex flex-col gap-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TileTitle>By month</TileTitle>
              <span className="flex gap-3.5 text-sm text-slate">
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[4px] bg-ink" />
                  Earned
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-[4px] bg-butter" />
                  Booked
                </span>
              </span>
            </div>
            {hasChartData ? (
              <EarningsChart data={chart} />
            ) : (
              <p className="py-10 text-center text-[15px] text-slate">
                Nothing paid in the last {MONTHS_SHOWN} months yet.
              </p>
            )}
          </Tile>

          {rows.length > 0 && (
            <Tile className="p-2.5 sm:p-2.5">
              <div className="hidden grid-cols-[1.2fr_1.6fr_1fr_0.8fr] gap-3 px-3.5 py-3 text-[13px] font-bold text-slate sm:grid">
                <span>Trip ends</span>
                <span>Trip</span>
                <span>Status</span>
                <span className="text-right">You get</span>
              </div>
              {rows.map((t, i) => {
                const status = rowStatus(t);
                return (
                  <div
                    key={t.id}
                    className={`figures grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 rounded-2xl p-3.5 text-[15px] sm:grid-cols-[1.2fr_1.6fr_1fr_0.8fr] ${
                      i % 2 === 0 ? "bg-board" : ""
                    }`}
                  >
                    <span className="max-sm:font-bold">{formatDateShort(t.ends_at)}</span>
                    <span className="order-3 col-span-2 text-slate sm:order-none sm:col-span-1 sm:text-ink">
                      {firstName(t.guest?.full_name)} · {t.vehicles ? `${t.vehicles.make} ${t.vehicles.model}` : "Car"}
                    </span>
                    <span className="order-4 sm:order-none">
                      <Tag tone={status.tone}>{status.label}</Tag>
                    </span>
                    <span className="text-right font-extrabold">{formatCurrency(hostEarningsCents(t.subtotal_cents))}</span>
                  </div>
                );
              })}
            </Tile>
          )}
        </>
      )}
    </div>
  );
}
