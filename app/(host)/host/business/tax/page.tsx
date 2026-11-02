import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { createClient, getUser } from "@/lib/supabase/server";
import { settleTripStatuses } from "@/lib/trips";
import { earningYears, loadEarnings, taxYear, yearOf } from "@/lib/earnings";
import { cn, formatCurrency, pluralize } from "@/lib/utils";
import { Divider, EmptyState, PageTitle, PriceRow, Tile, TileTitle } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { EarningsFilters } from "@/components/host/earnings/EarningsFilters";

export const instant = false;
export const metadata = { title: "Tax summary" };

const COLUMNS = "grid-cols-[2fr_0.6fr_1fr_1fr_1fr_1fr_1fr]";

export default async function TaxSummaryPage({ searchParams }: PageProps<"/host/business/tax">) {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login?redirectTo=/host/business/tax");

  await settleTripStatuses(user.id);
  const data = await loadEarnings(supabase, user.id);

  const raw = await searchParams;
  const years = earningYears(data);
  const year = typeof raw.year === "string" && years.includes(raw.year) ? raw.year : yearOf(new Date());
  const { totals, cars } = taxYear(data, year);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <PageTitle
        title="Tax summary"
        action={
          cars.length > 0 && (
            <Button asChild size="sm" className="h-10 text-[15px]">
              <a href={`/host/business/tax/csv?year=${year}`} download>
                <Download /> Download CSV
              </a>
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[15px] text-slate">A summary of your Cascade earnings, not a tax form.</p>
        <Suspense>
          <EarningsFilters years={years} year={year} />
        </Suspense>
      </div>

      {cars.length === 0 ? (
        <EmptyState title={`Nothing in ${year}`} body="Finished trips, guest charges and refunds show up here." />
      ) : (
        <>
          <div className="figures grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
            <div className="rounded-[26px] bg-mint p-5">
              <p className="text-sm font-semibold text-mint-ink">Net paid out</p>
              <p className="font-display text-[40px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[52px]">
                {formatCurrency(totals.paidOutCents)}
              </p>
              <p className="text-sm text-mint-ink">Of what you earned in {year}.</p>
            </div>
            <div className="rounded-[26px] bg-peach p-5">
              <p className="text-sm font-semibold text-peach-ink">Owed to you</p>
              <p className="font-display text-[40px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[52px]">
                {formatCurrency(totals.owedCents)}
              </p>
              <p className="text-sm text-peach-ink">Earned, not paid out yet.</p>
            </div>
            <div className="rounded-[26px] bg-white p-5">
              <p className="text-sm font-semibold text-slate">Trips</p>
              <p className="font-display text-[40px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[52px]">
                {totals.trips}
              </p>
              <p className="text-sm text-slate">Finished in {year}.</p>
            </div>
          </div>

          <Tile className="flex flex-col gap-3 sm:p-6">
            <TileTitle>{year} in full</TileTitle>
            <PriceRow label="Gross trip earnings" value={formatCurrency(totals.grossCents)} />
            <PriceRow label="Cascade fee" value={`−${formatCurrency(totals.feeCents)}`} />
            <PriceRow label="Guest charges collected" value={formatCurrency(totals.chargesCents)} />
            <Divider />
            <PriceRow strong label="Net earned" value={formatCurrency(totals.netCents)} />
            <PriceRow
              className="text-slate"
              label={`Refunds, ${pluralize(totals.refundedTrips, "trip")}, not counted above`}
              value={formatCurrency(totals.refundedCents)}
            />
          </Tile>

          <section className="overflow-x-auto rounded-[30px] bg-white p-2.5">
            <div className="figures flex min-w-[760px] flex-col">
              <div className={cn("grid gap-3 px-3.5 py-3 text-[13px] font-bold text-slate", COLUMNS)}>
                <span>Car</span>
                <span className="text-right">Trips</span>
                <span className="text-right">Gross</span>
                <span className="text-right">Cascade fee</span>
                <span className="text-right">Guest charges</span>
                <span className="text-right">Net earned</span>
                <span className="text-right">Paid out</span>
              </div>
              {cars.map((car, i) => (
                <div
                  key={car.id}
                  className={cn("grid items-center gap-3 rounded-[16px] p-3.5 text-[15px]", COLUMNS, i % 2 === 0 && "bg-board")}
                >
                  <span className="truncate font-bold">{car.name}</span>
                  <span className="text-right">{car.trips}</span>
                  <span className="text-right">{formatCurrency(car.grossCents)}</span>
                  <span className="text-right">{formatCurrency(car.feeCents)}</span>
                  <span className="text-right">{formatCurrency(car.chargesCents)}</span>
                  <span className="text-right font-extrabold">{formatCurrency(car.netCents)}</span>
                  <span className="text-right">{formatCurrency(car.paidOutCents)}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
