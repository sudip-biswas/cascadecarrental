"use client";

import { CircleHelp } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EARNING_SERIES } from "@/components/host/EarningsChart";
import type { Totals } from "@/lib/earnings";
import { formatPrice } from "@/lib/utils";

const HELP: Record<keyof Totals, string> = {
  trips: "What you kept from finished trips: 80% of each trip's price, after Cascade's fee. Counted in the month the trip ended.",
  reimbursements: "Fuel, tolls, cleaning and other costs guests paid back after a trip. You keep all of it.",
  upcoming: "Trips that are booked and paid but haven't ended yet. They move to trip earnings when the car comes back.",
  missed: "What you would have earned from trips that were cancelled, by you or the guest, and requests that were declined or not answered in time.",
};

/** Totals for each part of the chart, each with a short explanation behind a ? button. */
export function EarningsLegend({ totals }: { totals: Totals }) {
  return (
    <ul className="figures flex flex-wrap gap-x-5 gap-y-2.5 text-[15px]">
      {EARNING_SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-2">
          <span className="size-3.5 shrink-0 rounded-[4px]" style={{ background: s.color }} />
          <span>
            <b className="font-extrabold">{formatPrice(Math.round(totals[s.key] / 100) * 100)}</b> {s.label}
          </span>
          <Popover>
            <PopoverTrigger
              aria-label={`What counts as ${s.label.toLowerCase()}`}
              className="rounded-full text-slate transition-colors hover:text-ink"
            >
              <CircleHelp className="size-4" strokeWidth={2} />
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3.5 text-[14px] leading-snug">{HELP[s.key]}</PopoverContent>
          </Popover>
        </li>
      ))}
    </ul>
  );
}
