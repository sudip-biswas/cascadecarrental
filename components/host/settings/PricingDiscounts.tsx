import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { DISCOUNT_TIERS, HOST_SHARE, NON_REFUNDABLE_DISCOUNT, takeHomeCents, type DiscountColumn } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";
import type { Vehicle } from "@/lib/supabase/types";
import { Tag } from "@/components/kit";
import { VehicleEditDialog } from "@/components/host/VehicleEditDialog";
import { PricingBoost } from "@/components/host/settings/PricingBoost";

type Tier = (typeof DISCOUNT_TIERS)[number];

/** Turo's three cards: the tiers grouped by how long the trip is, with the miles a guest gets over that stretch. */
const GROUPS: { title: string; columns: DiscountColumn[]; per: string; perDays: number }[] = [
  { title: "Daily trips", columns: ["three_day_discount_pct"], per: "day", perDays: 1 },
  { title: "Weekly trips", columns: ["weekly_discount_pct", "two_week_discount_pct", "three_week_discount_pct"], per: "week", perDays: 7 },
  { title: "Monthly trips", columns: ["monthly_discount_pct"], per: "month", perDays: 30 },
];

const tierFor = (column: DiscountColumn) => DISCOUNT_TIERS.find((t) => t.column === column) as Tier;

function TierLine({ car, tier }: { car: Vehicle; tier: Tier }) {
  const pct = car[tier.column];
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="flex min-w-0 flex-col">
        <span className="text-base font-bold">{tier.name} take-home</span>
        <span className="text-sm text-slate">{pct > 0 ? `${pct}% off` : "No discount"}</span>
      </span>
      <span className="figures text-right text-[22px] font-extrabold">
        {formatPrice(Math.round(takeHomeCents(car.daily_rate_cents, tier.days, pct) / 100) * 100)}
      </span>
    </div>
  );
}

/** Pricing & discounts on the host's car page: day prices, last-minute boost, and Turo-style trip-length discounts. */
export function PricingDiscounts({ car }: { car: Vehicle }) {
  const fee = Math.round((1 - HOST_SHARE) * 100);

  return (
    <section className="flex flex-col gap-5 rounded-[30px] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[26px]">Pricing &amp; discounts</h2>
        <p className="text-[15px] text-slate">
          Take-home is what you keep from a trip at {formatPrice(car.daily_rate_cents)} a day, after the discount and
          Cascade&apos;s {fee}% fee.
        </p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4">
        <div className="flex flex-col gap-3 rounded-[24px] bg-board p-5">
          <h3 className="text-[20px]">Daily prices</h3>
          <p className="text-[15px] text-slate">Check your prices and set your own for single days, like holidays or game days.</p>
          <Link
            href={`/host/calendar?car=${car.id}`}
            className="flex items-center gap-2 self-start rounded-[14px] bg-white px-4 py-3 text-[15px] font-bold hover:bg-line"
          >
            <CalendarDays className="size-[18px]" /> Review prices on the calendar
          </Link>
        </div>
        <PricingBoost
          vehicleId={car.id}
          dailyRateCents={car.daily_rate_cents}
          boostPct={car.last_minute_boost_pct}
          noticeHours={car.advance_notice_hours}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-[22px]">Attract longer trips</h3>
          <span className="text-sm text-slate">A trip gets the best discount it qualifies for, never two.</span>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
          {GROUPS.map((group) => {
            const tiers = group.columns.map(tierFor);
            return (
              <div key={group.title} className="flex flex-col gap-1 rounded-[24px] bg-board p-5">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <h4 className="text-[18px] font-extrabold">{group.title}</h4>
                  <VehicleEditDialog
                    vehicleId={car.id}
                    title={group.title}
                    note={`Off the trip price for trips of ${tiers.map((t) => `${t.days}+`).join(", ")} days. A longer trip gets a bigger discount only if you set one.`}
                    fields={tiers.map((t) => ({
                      column: t.column,
                      label: `${t.name} discount`,
                      value: car[t.column],
                      unit: "percent" as const,
                      min: 0,
                      max: 50,
                    }))}
                  />
                </div>
                {tiers.map((tier) => (
                  <TierLine key={tier.column} car={car} tier={tier} />
                ))}
                <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-line pt-2.5 text-[15px]">
                  <span className="text-slate">Distance per {group.per}</span>
                  <span className="figures font-bold">
                    {(car.distance_included_mi * group.perDays).toLocaleString("en-US")} mi
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="flex flex-wrap items-center gap-2 text-sm text-slate">
          <Tag tone="mint">Pay now</Tag>
          Guests who pay up front get another {Math.round(NON_REFUNDABLE_DISCOUNT * 100)}% off, which comes off your take-home
          too.
        </p>
      </div>
    </section>
  );
}
