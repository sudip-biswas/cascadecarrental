"use client";

import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DAYS_PER_MONTH } from "@/lib/pricing";
import { cn, formatDay, pluralize, zonedInstant } from "@/lib/utils";
import { MONTH_OPTIONS, addDays, keyToLocalDate, localDateToKey, todayKey, type DateKey } from "./dates";

interface Props {
  from?: DateKey;
  months: number;
  onChange: (from: DateKey | undefined, months: number) => void;
  className?: string;
}

/** Turo's monthly search: a start date and how many months, with the return date it lands on. */
export function MonthlyDatesPicker({ from, months, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const today = todayKey();
  const until = from ? addDays(from, months * DAYS_PER_MONTH) : undefined;

  return (
    <div className={cn("grid w-full grid-cols-2 gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex min-w-0 flex-col rounded-[16px] bg-board px-4 py-2 text-left transition-colors outline-none hover:bg-line focus-visible:ring-2 focus-visible:ring-ink"
          >
            <span className="text-[13px] font-semibold text-slate">Start</span>
            <span className={cn("truncate text-base leading-snug font-bold", !from && "text-slate")}>
              {from ? formatDay(zonedInstant(from)) : "Add date"}
            </span>
            <span className="truncate text-[12px] leading-snug text-slate">
              {until ? `Return ${formatDay(zonedInstant(until))}` : `${DAYS_PER_MONTH} days a month`}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <Calendar
            mode="single"
            selected={from ? keyToLocalDate(from) : undefined}
            onSelect={(date) => {
              onChange(date ? localDateToKey(date) : undefined, months);
              if (date) setOpen(false);
            }}
            defaultMonth={from ? keyToLocalDate(from) : undefined}
            disabled={(date) => localDateToKey(date) < today}
            className="p-1 [--cell-size:--spacing(10)]"
          />
        </PopoverContent>
      </Popover>
      <label className="flex min-w-0 flex-col rounded-[16px] bg-board px-4 py-2 focus-within:ring-2 focus-within:ring-ink">
        <span className="text-[13px] font-semibold text-slate">For</span>
        <select
          value={months}
          onChange={(e) => onChange(from, Number(e.target.value))}
          className="w-full min-w-0 cursor-pointer bg-transparent text-base leading-snug font-bold outline-none"
        >
          {MONTH_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {pluralize(n, "month")}
            </option>
          ))}
        </select>
        <span className="text-[12px] leading-snug text-slate">Monthly discounts apply</span>
      </label>
    </div>
  );
}
