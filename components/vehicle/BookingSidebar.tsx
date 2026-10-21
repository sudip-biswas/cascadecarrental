"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Divider, PriceRow } from "@/components/kit";
import { computePricing, dayRates, NON_REFUNDABLE_DISCOUNT, type DailyPrices, type RateType } from "@/lib/pricing";
import { cn, formatCurrency, formatPrice, formatRange, pluralize, zonedInstant } from "@/lib/utils";
import type { Vehicle } from "@/lib/supabase/types";
import { TripDatesPicker } from "@/components/search/TripDatesPicker";
import {
  bookedNights,
  daysBetween,
  overlapsBooked,
  todayKey,
  type DateKey,
  type Range,
} from "@/components/search/dates";

export type BookingVehicle = Pick<
  Vehicle,
  | "id"
  | "daily_rate_cents"
  | "weekly_discount_pct"
  | "monthly_discount_pct"
  | "min_trip_days"
  | "max_trip_days"
  | "advance_notice_hours"
  | "instant_book"
>;

interface Props {
  vehicle: BookingVehicle;
  hostName: string;
  unavailable: Range[];
  /** The host's own prices for single days, from today on. */
  dailyPrices: DailyPrices;
  initialFrom?: DateKey;
  initialUntil?: DateKey;
  initialRate: RateType;
  isLoggedIn: boolean;
  /** The details column, rendered by the page. */
  children: React.ReactNode;
}

/** Why a date range can't be booked, or null when it can. */
function problemWith(
  vehicle: BookingVehicle,
  from: DateKey | undefined,
  until: DateKey | undefined,
  nights: Set<DateKey>
): string | null {
  if (!from) return "Pick dates first";
  if (!until) return "Pick a return date";
  if (from < todayKey()) return "Pick-up can't be in the past.";
  const hoursAhead = (zonedInstant(from).getTime() - Date.now()) / 3_600_000;
  if (hoursAhead < vehicle.advance_notice_hours) {
    return `The host needs ${pluralize(vehicle.advance_notice_hours, "hour")} notice. Pick a later day.`;
  }
  const days = daysBetween(from, until);
  if (days < vehicle.min_trip_days) return `This car needs at least ${pluralize(vehicle.min_trip_days, "day")}.`;
  if (vehicle.max_trip_days && days > vehicle.max_trip_days) {
    return `This car can be booked for up to ${pluralize(vehicle.max_trip_days, "day")}.`;
  }
  if (overlapsBooked(from, until, nights)) return "Some of those days are taken. Try other dates.";
  return null;
}

export function CarBooking({
  vehicle,
  hostName,
  unavailable,
  dailyPrices,
  initialFrom,
  initialUntil,
  initialRate,
  isLoggedIn,
  children,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = useState(initialFrom);
  const [until, setUntil] = useState(initialUntil);
  const [rate, setRate] = useState<RateType>(initialRate);

  const nights = useMemo(() => bookedNights(unavailable), [unavailable]);
  const problem = problemWith(vehicle, from, until, nights);
  const ready = !problem && from && until;

  const days = from && until ? daysBetween(from, until) : 0;
  const priceFor = (rateType: RateType) =>
    computePricing({
      dailyRateCents: vehicle.daily_rate_cents,
      days: Math.max(days, 1),
      dayRatesCents: from ? dayRates(vehicle.daily_rate_cents, from, Math.max(days, 1), dailyPrices) : undefined,
      rateType,
      weeklyDiscountPct: vehicle.weekly_discount_pct,
      monthlyDiscountPct: vehicle.monthly_discount_pct,
    });
  const pricing = priceFor(rate);
  const payNow = priceFor("non_refundable");
  const flexible = priceFor("refundable");

  function query(next: { from?: DateKey; until?: DateKey; rate: RateType }) {
    const params = new URLSearchParams();
    if (next.from && next.until) {
      params.set("from", next.from);
      params.set("until", next.until);
    }
    if (next.rate === "refundable") params.set("rate", "refundable");
    return params.toString();
  }

  function sync(next: { from?: DateKey; until?: DateKey; rate: RateType }) {
    const qs = query(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function changeDates(nextFrom?: DateKey, nextUntil?: DateKey) {
    setFrom(nextFrom);
    setUntil(nextUntil);
    if (!nextFrom || nextUntil) sync({ from: nextFrom, until: nextUntil, rate });
  }

  function changeRate(next: RateType) {
    setRate(next);
    sync({ from, until, rate: next });
  }

  const checkoutUrl = `/cars/${vehicle.id}/checkout?${query({ from, until, rate })}`;
  const reserveHref = isLoggedIn ? checkoutUrl : `/login?redirectTo=${encodeURIComponent(checkoutUrl)}`;

  const insideNotice = (key: DateKey) =>
    (zonedInstant(key).getTime() - Date.now()) / 3_600_000 < vehicle.advance_notice_hours;

  const chargeNote = vehicle.instant_book
    ? "Instant book: you're charged when you book."
    : `Nothing is charged until ${hostName} says yes. Your card is only held.`;

  return (
    <div className="flex flex-wrap items-start gap-5">
      <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-3.5">{children}</div>

      <aside
        id="book"
        className="flex min-w-0 flex-[1_1_360px] scroll-mt-4 flex-col gap-3.5 rounded-[30px] bg-white p-5 sm:p-[22px] lg:sticky lg:top-4"
      >
        <div className="figures flex items-baseline justify-between">
          <span className="font-display text-[46px] leading-none font-extrabold tracking-[-0.03em]">
            {formatPrice(vehicle.daily_rate_cents)}
            <span className="font-sans text-base font-medium tracking-normal text-slate"> /day</span>
          </span>
          {days > 0 && <span className="text-[15px] text-slate">{pluralize(days, "day")}</span>}
        </div>

        <TripDatesPicker
          from={from}
          until={until}
          onChange={changeDates}
          isDisabled={insideNotice}
          booked={nights}
          note={from && until && problem ? problem : undefined}
        />

        <div role="radiogroup" aria-label="How to pay" className="grid grid-cols-2 gap-2">
          {(
            [
              {
                value: "non_refundable" as const,
                title: "Pay now",
                body: ready
                  ? `Save ${formatCurrency(payNow.savingsCents)}. Free to cancel for 24 hours.`
                  : `Save ${Math.round(NON_REFUNDABLE_DISCOUNT * 100)}%. Free to cancel for 24 hours.`,
              },
              {
                value: "refundable" as const,
                title: "Flexible",
                body: ready
                  ? `${formatCurrency(flexible.totalCents)}. Free to cancel until pick-up.`
                  : "Free to cancel until pick-up.",
              },
            ]
          ).map((option) => {
            const on = rate === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => changeRate(option.value)}
                className={cn(
                  "flex flex-col gap-1 rounded-[18px] p-3.5 text-left transition-colors",
                  on ? "bg-ink text-white" : "bg-board hover:bg-line"
                )}
              >
                <span className="flex items-center justify-between text-base font-bold">
                  {option.title}
                  <span
                    aria-hidden
                    className={cn(
                      "size-[18px] rounded-full",
                      on ? "border-[5px] border-cobalt bg-white" : "border-2 border-quiet"
                    )}
                  />
                </span>
                <span className={cn("text-sm", on ? "text-[#c9ccd3]" : "text-slate")}>{option.body}</span>
              </button>
            );
          })}
        </div>

        {ready && (
          <div className="figures flex flex-col gap-2.5 pt-1">
            <div aria-hidden className="flex h-3 gap-[3px] overflow-hidden rounded-[6px]">
              <span className="bg-ink" style={{ flex: pricing.subtotalCents }} />
              <span className="bg-sky" style={{ flex: pricing.taxCents }} />
            </div>
            <PriceRow
              label={
                pricing.ratesVary
                  ? `${pluralize(days, "day")}, avg ${formatPrice(pricing.dailyRateCents)}`
                  : `${pluralize(days, "day")} × ${formatPrice(pricing.dailyRateCents)}`
              }
              value={formatCurrency(pricing.baseCents)}
            />
            {pricing.lengthDiscountCents > 0 && (
              <PriceRow
                label={`${days >= 30 ? "Month" : "Week"} discount, ${pricing.lengthDiscountPct}%`}
                value={`−${formatCurrency(pricing.lengthDiscountCents)}`}
              />
            )}
            {pricing.savingsCents > 0 && (
              <PriceRow
                label={`Pay-now discount, ${Math.round(NON_REFUNDABLE_DISCOUNT * 100)}%`}
                value={`−${formatCurrency(pricing.savingsCents)}`}
              />
            )}
            <PriceRow label="Tax" value={formatCurrency(pricing.taxCents)} />
            <Divider />
            <PriceRow label="Total" value={formatCurrency(pricing.totalCents)} strong />
            <span className="text-[13px] text-slate">Protection is optional and picked at checkout.</span>
          </div>
        )}

        {ready ? (
          <Button asChild size="lg" className="min-h-[60px] text-lg">
            <Link href={reserveHref}>
              Reserve
              <ArrowRight className="size-5" strokeWidth={2} />
            </Link>
          </Button>
        ) : (
          <Button size="lg" disabled className="min-h-[60px] text-lg">
            {!from || !until ? problem : "Can't book these dates"}
          </Button>
        )}
        {from && until && problem && (
          <p role="alert" className="text-center text-sm font-semibold text-error">
            {problem}
          </p>
        )}
        <p className="text-center text-sm text-slate">{chargeNote}</p>
      </aside>

      {/* Phones: the price and button stay in reach while scrolling the details. */}
      <div className="sticky bottom-0 z-30 -mx-4 flex w-[calc(100%+2rem)] items-center justify-between gap-3 rounded-t-[26px] bg-white px-4 pt-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-6 lg:hidden">
        {ready ? (
          <>
            <span className="figures min-w-0">
              <span className="block text-[22px] font-extrabold">
                {formatCurrency(pricing.totalCents)} <span className="text-sm font-semibold text-slate">total</span>
              </span>
              <span className="block truncate text-[13px] text-slate">
                {formatRange(zonedInstant(from), zonedInstant(until))} · {formatPrice(vehicle.daily_rate_cents)}/day · tax in
              </span>
            </span>
            <Button asChild className="h-[54px] shrink-0 px-6 text-[17px]">
              <Link href={reserveHref}>Reserve</Link>
            </Button>
          </>
        ) : (
          <>
            <span className="min-w-0">
              <span className="block text-[22px] font-extrabold">
                {formatPrice(vehicle.daily_rate_cents)} <span className="text-sm font-semibold text-slate">/day</span>
              </span>
              <span className="block truncate text-[13px] text-slate">
                {from && until && problem ? problem : "Add dates to see the total"}
              </span>
            </span>
            <Button asChild variant="default" className="h-[54px] shrink-0 px-6 text-[17px]">
              <a href="#book">{from && until ? "Change dates" : "Pick dates"}</a>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
