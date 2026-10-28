import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Download } from "lucide-react";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { settleTripStatuses } from "@/lib/trips";
import { carName, earningYears, earningsYear, loadEarnings, yearOf } from "@/lib/earnings";
import { formatPrice } from "@/lib/utils";
import { EmptyState, PageTitle, Tile } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { EarningsChart } from "@/components/host/EarningsChart";
import { CarRanking } from "@/components/host/earnings/CarRanking";
import { EarningsFilters } from "@/components/host/earnings/EarningsFilters";
import { EarningsLegend } from "@/components/host/earnings/EarningsLegend";
import { PayoutBanner, PayoutStatusFallback } from "@/components/host/earnings/PayoutStatus";

export const instant = false;
export const metadata = { title: "Earnings" };

export default async function EarningsPage({ searchParams }: PageProps<"/host/business/earnings">) {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login?redirectTo=/host/business/earnings");

  const raw = await searchParams;
  const setup = raw.payout_setup === "done" || raw.payout_setup === "refresh" ? raw.payout_setup : undefined;

  await settleTripStatuses(user.id);
  const [data, { data: profile }] = await Promise.all([
    loadEarnings(supabase, user.id),
    createAdminClient().from("profiles").select("stripe_account_id").eq("id", user.id).single(),
  ]);

  const years = earningYears(data);
  const year = typeof raw.year === "string" && years.includes(raw.year) ? raw.year : yearOf(new Date());
  const car = typeof raw.car === "string" ? data.cars.find((c) => c.id === raw.car) : undefined;
  const { months, totals, earned, ranking } = earningsYear(data, year, car?.id);
  const hasChartData = months.some((m) => m.trips || m.upcoming || m.reimbursements || m.missed);

  const csv = new URLSearchParams({ year, ...(car ? { car: car.id } : {}) });

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <PageTitle
        title="Earnings"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Suspense>
              <EarningsFilters
                cars={data.cars.map((c) => ({ id: c.id, name: carName(c) }))}
                years={years}
                year={year}
              />
            </Suspense>
          </div>
        }
      />

      <Suspense fallback={<PayoutStatusFallback tall />}>
        <PayoutBanner accountId={profile?.stripe_account_id ?? null} setup={setup} />
      </Suspense>

      {data.trips.length === 0 ? (
        <EmptyState
          title="No trips yet"
          body="Once guests book your cars, what you earn from each trip shows up here."
        />
      ) : (
        <>
          <Tile className="flex flex-col gap-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="font-display text-[34px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[44px]">
                  <span className="figures">{formatPrice(Math.round(earned / 100) * 100)}</span> earned in {year}
                </h2>
                <p className="text-[15px] text-slate">
                  {car ? `${carName(car)} only. ` : ""}Finished trips and reimbursements, after Cascade&apos;s fee.
                </p>
              </div>
              <div className="flex max-w-[340px] flex-col items-start gap-2 sm:items-end">
                <Button asChild variant="secondary" size="sm" className="h-10 text-[15px]">
                  <a href={`/host/business/earnings/csv?${csv}`} download>
                    <Download /> Download CSV
                  </a>
                </Button>
                <p className="text-[13px] leading-snug text-slate sm:text-right">
                  Every trip with its price, Cascade&apos;s fee and when it was paid out, for your bookkeeping.
                </p>
              </div>
            </div>

            {hasChartData ? (
              <EarningsChart data={months} />
            ) : (
              <p className="py-12 text-center text-[15px] text-slate">
                No trips {car ? "for this car " : ""}in {year}.
              </p>
            )}
            <EarningsLegend totals={totals} />
          </Tile>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/host/business/transactions?year=${year}`}
              className="flex items-center gap-2 rounded-[12px] bg-white px-3.5 py-2.5 text-[15px] font-bold transition-colors hover:bg-line"
            >
              Transactions and payouts <ArrowRight className="size-[18px]" />
            </Link>
            <Link
              href="/host/business/performance"
              className="flex items-center gap-2 rounded-[12px] bg-white px-3.5 py-2.5 text-[15px] font-bold transition-colors hover:bg-line"
            >
              How your cars are doing <ArrowRight className="size-[18px]" />
            </Link>
          </div>

          {ranking.length > 0 && <CarRanking ranking={ranking} year={year} selected={car?.id} />}
        </>
      )}
    </div>
  );
}
