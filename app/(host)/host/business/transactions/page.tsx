import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { settleTripStatuses } from "@/lib/trips";
import { earningYears, loadEarnings, nextPayout, owedCents, reservationNumber, transactions, yearOf } from "@/lib/earnings";
import { cn, formatCurrency, formatDate, formatDateShort } from "@/lib/utils";
import { EmptyState, PageTitle, Tag } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { firstName } from "@/components/host/bits";
import { EarningsFilters } from "@/components/host/earnings/EarningsFilters";
import { PayoutStatusFallback, PayoutStatusRow } from "@/components/host/earnings/PayoutStatus";

export const instant = false;
export const metadata = { title: "Transactions" };

const COLUMNS = "grid-cols-[2fr_1fr_1fr_1fr_1.1fr]";

export default async function TransactionsPage({ searchParams }: PageProps<"/host/business/transactions">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/business/transactions");

  await settleTripStatuses(user.id);
  const [data, { data: profile }] = await Promise.all([
    loadEarnings(supabase, user.id),
    createAdminClient().from("profiles").select("stripe_account_id").eq("id", user.id).single(),
  ]);
  const accountId = profile?.stripe_account_id ?? null;

  const raw = await searchParams;
  const years = earningYears(data);
  const year = typeof raw.year === "string" && years.includes(raw.year) ? raw.year : yearOf(new Date());
  const rows = transactions(data, year);
  const owed = owedCents(data);
  const next = nextPayout(data, Boolean(accountId));

  const nextLabel =
    next === "now" ? "Today" : next === "needs-bank" ? "Once your bank is connected" : next ? formatDate(next) : "–";
  const nextNote =
    next === "now"
      ? "What we owe you is on its way to your Stripe account."
      : next === "needs-bank"
        ? "We're holding your earnings until you connect a bank account."
        : next
          ? "When your next booked trip ends. Your share is sent the day a trip ends."
          : "Nothing booked yet. Your share is sent the day a trip ends.";

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <PageTitle
        title="Transactions"
        action={
          rows.length > 0 && (
            <Button asChild size="sm" className="h-10 text-[15px]">
              <a href={`/host/business/transactions/csv?year=${year}`} download>
                <Download /> Download CSV
              </a>
            </Button>
          )
        }
      />

      <Suspense fallback={<PayoutStatusFallback />}>
        <PayoutStatusRow accountId={accountId} />
      </Suspense>

      <div className="figures grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
        <div className="rounded-[26px] bg-peach p-5">
          <p className="text-sm font-semibold text-peach-ink">Owed to you</p>
          <p className="font-display text-[40px] leading-tight font-extrabold tracking-[-0.03em] sm:text-[52px]">
            {formatCurrency(owed)}
          </p>
          <p className="text-sm text-peach-ink">Finished trips and reimbursements not paid out yet.</p>
        </div>
        <div className="rounded-[26px] bg-white p-5">
          <p className="text-sm font-semibold text-slate">Next payout</p>
          <p
            className={cn(
              "font-display leading-tight font-extrabold tracking-[-0.03em]",
              next === "needs-bank" ? "py-2 text-[28px] sm:text-[32px]" : "text-[40px] sm:text-[52px]"
            )}
          >
            {nextLabel}
          </p>
          <p className="text-sm text-slate">{nextNote}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[15px] font-bold">Showing transactions for</span>
        <Suspense>
          <EarningsFilters years={years} year={year} />
        </Suspense>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={`Nothing in ${year}`}
          body="Finished trips, reimbursements from guests and refunds show up here."
        />
      ) : (
        <section className="overflow-x-auto rounded-[30px] bg-white p-2.5">
          <div className="figures flex min-w-[760px] flex-col">
            <div className={cn("grid gap-3 px-3.5 py-3 text-[13px] font-bold text-slate", COLUMNS)}>
              <span>Type</span>
              <span>Reservation</span>
              <span>Date</span>
              <span className="text-right">Earnings</span>
              <span className="text-right">Payment</span>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.key}
                className={cn("grid items-center gap-3 rounded-[16px] p-3.5 text-[15px]", COLUMNS, i % 2 === 0 && "bg-board")}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <Link href={`/host/trips/${r.tripId}`} className="w-fit font-bold underline-offset-4 hover:underline">
                    {firstName(r.guest)}&apos;s trip
                  </Link>
                  <span className="truncate text-[13px] text-slate">With {r.car}</span>
                  <span className="text-[13px] text-slate">
                    {r.note}
                    {r.grossCents !== null &&
                      ` · ${formatCurrency(r.grossCents)} less ${formatCurrency(r.feeCents ?? 0)} Cascade fee`}
                  </span>
                </span>
                <span className="font-mono text-[14px]">{reservationNumber(r.tripId)}</span>
                <span>{formatDate(r.date)}</span>
                <span className={cn("text-right font-extrabold", r.kind === "refund" && "text-slate")}>
                  {formatCurrency(r.amountCents)}
                </span>
                <span className="flex justify-end">
                  {r.kind === "refund" ? (
                    <span className="text-slate">–</span>
                  ) : r.paidOutAt ? (
                    <Tag tone="mint">Paid {formatDateShort(r.paidOutAt)}</Tag>
                  ) : (
                    <Tag tone="butter">Owed</Tag>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
      <p className="text-sm text-slate">
        You keep 80% of each trip&apos;s price and all of any reimbursement. Refunded trips are listed at $0.
      </p>
    </div>
  );
}
