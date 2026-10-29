"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Divider, PriceRow } from "@/components/kit";
import {
  computePricing,
  DAYS_PER_MONTH,
  dayRates,
  DISCOUNT_TIERS,
  lastMinuteBoostPct,
  NON_REFUNDABLE_DISCOUNT,
  stretchPrice,
  YOUNG_DRIVER_AGE,
  type DailyPrices,
  type RateType,
} from "@/lib/pricing";
import { cn, formatCurrency, formatPrice, formatRange, pluralize, zonedInstant } from "@/lib/utils";
import type { Vehicle } from "@/lib/supabase/types";
import { TripDatesPicker } from "@/components/search/TripDatesPicker";
import { PickupPicker } from "@/components/checkout/DeliverySection";
import { PayOverTimeNote } from "@/components/checkout/PayOverTime";
import { CAR_SPOT, spotFeeCents, type PickupOption } from "@/lib/locations";
import {
  DEFAULT_TIME,
  addDays,
  bookedNights,
  daysBetween,
  todayKey,
  type DateKey,
  type Range,
} from "@/components/search/dates";
import {
  ALWAYS_AVAILABLE,
  hoursHint,
  isClosedOn,
  overlapsRanges,
  snapTime,
  timesOn,
  tripRuleProblem,
  type TripRules,
} from "@/lib/trip-rules";

export type BookingVehicle = Pick<
  Vehicle,
  | "id"
  | "daily_rate_cents"
  | "weekly_discount_pct"
  | "monthly_discount_pct"
  | "three_day_discount_pct"
  | "two_week_discount_pct"
  | "three_week_discount_pct"
  | "last_minute_boost_pct"
  | "min_trip_days"
  | "max_trip_days"
  | "advance_notice_hours"
  | "instant_book"
>;

export interface BookingPerks {
  minAge: number;
  youngDriverFeeCents: number;
  delivery: boolean;
  /** Names of the extras on offer. */
  extras: string[];
}

/** "Delivery available. Child seat and 2 more at checkout." and "Drivers 21+, under 25 adds $15/day." */
function perkLines(perks: BookingPerks): string[] {
  const offers = [
    perks.delivery && "Delivery available",
    perks.extras.length > 0 &&
      `${perks.extras[0]}${perks.extras.length > 1 ? ` and ${pluralize(perks.extras.length - 1, "more extra")}` : ""} at checkout`,
  ].filter(Boolean);
  const age =
    `Drivers ${perks.minAge}+` +
    (perks.youngDriverFeeCents > 0 && perks.minAge < YOUNG_DRIVER_AGE
      ? `, under ${YOUNG_DRIVER_AGE} adds ${formatPrice(perks.youngDriverFeeCents)}/day`
      : "");
  return [offers.length > 0 ? `${offers.join(". ")}.` : null, `${age}.`].filter((line) => line !== null);
}

interface Props {
  vehicle: BookingVehicle;
  hostName: string;
  unavailable: Range[];
  /** The host's own prices for single days, from today on. */
  dailyPrices: DailyPrices;
  /** Today's dynamic or custom price, shown a day before dates are picked. */
  todayCents: number;
  initialFrom?: DateKey;
  initialUntil?: DateKey;
  initialFromTime?: string;
  initialUntilTime?: string;
  initialRate: RateType;
  isLoggedIn: boolean;
  /** Age rule, delivery and extras, for one light line under the button. */
  perks?: BookingPerks;
  /** Weekend minimum and the host's pickup and return hours. Booked ranges already include the buffer. */
  tripRules?: Pick<TripRules, "weekend_min_two_days" | "hours">;
  /** Where the guest can get the car: its own spot first, then the host's spots. */
  pickup?: PickupOption[];
  /** The details column, rendered by the page. */
  children: React.ReactNode;
}

/** Why a date range can't be booked, or null when it can. */
function problemWith(
  rules: TripRules,
  from: DateKey | undefined,
  until: DateKey | undefined,
  unavailable: Range[],
  fromTime: string,
  untilTime: string,
): string | null {
  if (!from) return "Pick dates first";
  if (!until) return "Pick a return date";
  if (from < todayKey()) return "Pick-up can't be in the past.";
  const start = zonedInstant(from, fromTime);
  const end = zonedInstant(until, untilTime);
  const broken = tripRuleProblem(rules, start, end);
  if (broken) return broken;
  if (overlapsRanges(unavailable, start, end)) return "Some of those days are taken. Try other dates.";
  return null;
}

export function CarBooking({
  vehicle,
  hostName,
  unavailable,
  dailyPrices,
  todayCents,
  initialFrom,
  initialUntil,
  initialFromTime,
  initialUntilTime,
  initialRate,
  isLoggedIn,
  perks,
  tripRules,
  pickup = [],
  children,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = useState(initialFrom);
  const [until, setUntil] = useState(initialUntil);
  const [fromTime, setFromTime] = useState(initialFromTime ?? DEFAULT_TIME);
  const [untilTime, setUntilTime] = useState(initialUntilTime ?? DEFAULT_TIME);
  const [rate, setRate] = useState<RateType>(initialRate);
  const [spot, setSpot] = useState(CAR_SPOT);
  const pickedSpot = pickup.find((o) => o.id === spot);

  const nights = useMemo(() => bookedNights(unavailable), [unavailable]);
  const hours = tripRules?.hours ?? ALWAYS_AVAILABLE;
  const rules: TripRules = {
    ...vehicle,
    trip_buffer_hours: 0,
    weekend_min_two_days: tripRules?.weekend_min_two_days ?? false,
    hours,
  };
  const problem = problemWith(rules, from, until, unavailable, fromTime, untilTime);
  const ready = !problem && from && until;

  const days = from && until ? daysBetween(from, until, fromTime, untilTime) : 0;
  const priceFor = (rateType: RateType) =>
    computePricing({
      dailyRateCents: vehicle.daily_rate_cents,
      days: Math.max(days, 1),
      dayRatesCents: from ? dayRates(vehicle.daily_rate_cents, from, Math.max(days, 1), dailyPrices) : undefined,
      rateType,
      discounts: vehicle,
      boostPct: from ? lastMinuteBoostPct(vehicle, zonedInstant(from, fromTime)) : 0,
      // The custom radius adds a per-mile part once the address is known, at checkout.
      deliveryCents: pickedSpot ? spotFeeCents(pickedSpot, Math.max(days, 1)) : 0,
    });
  const pricing = priceFor(rate);
  // A day's price: the average over the dates once picked, else today's.
  const perDay = from && until && days > 0 ? pricing.dailyRateCents : todayCents;
  const firstTier = DISCOUNT_TIERS.find((tier) => vehicle[tier.column] > 0);
  const longTripDeal = firstTier && `Save ${vehicle[firstTier.column]}% on trips of ${firstTier.days}+ days.`;
  // Days inside the notice window, or when the host can't meet guests at all.
  const insideNotice = (key: DateKey) =>
    (zonedInstant(key, fromTime).getTime() - Date.now()) / 3_600_000 < vehicle.advance_notice_hours ||
    isClosedOn(hours, key);

  // A week and a month from the first day the host can meet, as Turo shows them before dates are picked.
  const [firstDay] = useState(() => {
    const today = todayKey();
    return [0, 1, 2, 3].map((i) => addDays(today, i)).find((key) => !insideNotice(key)) ?? addDays(today, 1);
  });
  const stretches = [
    { label: "1 week", days: 7, per: "week" },
    { label: "1 month", days: DAYS_PER_MONTH, per: "month" },
  ]
    .filter((s) => s.days >= vehicle.min_trip_days && (!vehicle.max_trip_days || s.days <= vehicle.max_trip_days))
    .map((s) => ({ ...s, ...stretchPrice(vehicle.daily_rate_cents, firstDay, s.days, dailyPrices, vehicle) }))
    .filter((s) => s.pct > 0);
  const payNow = priceFor("non_refundable");
  const flexible = priceFor("refundable");

  function query(next: { from?: DateKey; until?: DateKey; fromTime: string; untilTime: string; rate: RateType }) {
    const params = new URLSearchParams();
    if (next.from && next.until) {
      params.set("from", next.from);
      params.set("until", next.until);
      if (next.fromTime !== DEFAULT_TIME) params.set("fromTime", next.fromTime);
      if (next.untilTime !== DEFAULT_TIME) params.set("untilTime", next.untilTime);
    }
    if (next.rate === "refundable") params.set("rate", "refundable");
    return params.toString();
  }

  function sync(next: { from?: DateKey; until?: DateKey; fromTime: string; untilTime: string; rate: RateType }) {
    const qs = query(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function changeDates(nextFrom?: DateKey, nextUntil?: DateKey) {
    setFrom(nextFrom);
    setUntil(nextUntil);
    // Move the times into the host's hours for the new days.
    const nextFromTime = nextFrom ? snapTime(hours, nextFrom, fromTime) : fromTime;
    const nextUntilTime = nextUntil ? snapTime(hours, nextUntil, untilTime) : untilTime;
    setFromTime(nextFromTime);
    setUntilTime(nextUntilTime);
    if (!nextFrom || nextUntil) {
      sync({ from: nextFrom, until: nextUntil, fromTime: nextFromTime, untilTime: nextUntilTime, rate });
    }
  }

  function changeTimes(nextFromTime: string, nextUntilTime: string) {
    setFromTime(nextFromTime);
    setUntilTime(nextUntilTime);
    sync({ from, until, fromTime: nextFromTime, untilTime: nextUntilTime, rate });
  }

  function changeRate(next: RateType) {
    setRate(next);
    sync({ from, until, fromTime, untilTime, rate: next });
  }

  const checkoutUrl = `/cars/${vehicle.id}/checkout?${query({ from, until, fromTime, untilTime, rate })}${spot === CAR_SPOT ? "" : `&spot=${spot}`}`;
  const reserveHref = isLoggedIn ? checkoutUrl : `/login?redirectTo=${encodeURIComponent(checkoutUrl)}`;

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
            {formatPrice(perDay)}
            <span className="font-sans text-base font-medium tracking-normal text-slate"> /day</span>
          </span>
          {days > 0 && <span className="text-[15px] text-slate">{pluralize(days, "day")}</span>}
        </div>

        {!ready && stretches.length > 0 ? (
          <div className="flex flex-col gap-1 rounded-[18px] bg-mint p-1.5 text-mint-ink">
            {stretches.map((s) => (
              <button
                key={s.per}
                type="button"
                onClick={() => changeDates(firstDay, addDays(firstDay, s.days))}
                className="figures flex items-baseline justify-between gap-3 rounded-[13px] px-2.5 py-2 text-left transition-colors hover:bg-white/50"
              >
                <span className="text-sm font-semibold">{s.label}</span>
                <span className="text-[15px] font-extrabold">
                  {formatPrice(Math.round(s.cents / 100) * 100)}
                  <span className="font-semibold">/{s.per}</span>
                  <span className="font-semibold"> · save {s.pct}%</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          !ready &&
          longTripDeal && <p className="rounded-[14px] bg-mint px-3.5 py-2.5 text-sm font-semibold text-mint-ink">{longTripDeal}</p>
        )}

        <TripDatesPicker
          from={from}
          until={until}
          fromTime={fromTime}
          untilTime={untilTime}
          onChange={changeDates}
          onTimeChange={changeTimes}
          isDisabled={insideNotice}
          booked={nights}
          timeOptions={(key) => timesOn(hours, key)}
          note={from && until ? (problem ?? hoursHint(hours, from, until) ?? undefined) : undefined}
        />

        {pickup.length > 1 && <PickupPicker options={pickup} days={days} spot={spot} onSpot={setSpot} />}

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
            {pricing.boostCents > 0 && (
              <PriceRow
                label={`Last-minute price, ${pricing.boostPct}%`}
                value={`+${formatCurrency(pricing.boostCents)}`}
              />
            )}
            {pricing.lengthDiscountCents > 0 && (
              <PriceRow
                label={
                  <>
                    Trip savings <span className="text-slate">· {pricing.lengthDiscountLabel}</span>
                  </>
                }
                value={`−${formatCurrency(pricing.lengthDiscountCents)}`}
              />
            )}
            {pricing.savingsCents > 0 && (
              <PriceRow
                label={`Pay-now discount, ${Math.round(NON_REFUNDABLE_DISCOUNT * 100)}%`}
                value={`−${formatCurrency(pricing.savingsCents)}`}
              />
            )}
            {pricing.deliveryCents > 0 && pickedSpot && (
              <PriceRow
                label={pickedSpot.kind === "custom" ? "Delivery to you" : `Delivery to ${pickedSpot.name}`}
                value={formatCurrency(pricing.deliveryCents)}
              />
            )}
            <PriceRow label="Tax" value={formatCurrency(pricing.taxCents)} />
            <Divider />
            <PriceRow label="Total" value={formatCurrency(pricing.totalCents)} strong />
            <PayOverTimeNote amountCents={pricing.totalCents} />
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
        {perks &&
          perkLines(perks).map((line) => (
            <p key={line} className="-mt-2 text-center text-sm text-slate">
              {line}
            </p>
          ))}
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
                {formatRange(zonedInstant(from, fromTime), zonedInstant(until, untilTime))} · {formatPrice(perDay)}/day · tax in
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
                {formatPrice(perDay)} <span className="text-sm font-semibold text-slate">/day</span>
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
