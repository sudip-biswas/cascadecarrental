"use client";

import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DAYS_PER_MONTH } from "@/lib/pricing";
import { cn, formatDay, zonedInstant } from "@/lib/utils";
import { addDays, keyToLocalDate, localDateToKey, todayKey, type DateKey } from "./dates";

const MIN_MONTHS = 1;
const MAX_MONTHS = 6;

interface Props {
  from?: DateKey;
  months: number;
  onChange: (from: DateKey | undefined, months: number) => void;
  className?: string;
}

/** Stepper-style monthly picker: I want a car for N months, with ghost numbers and a computed date range. */
export function MonthlyDatesPicker({ from, months, onChange, className }: Props) {
  const [openCal, setOpenCal] = useState(false);
  const today = todayKey();
  const until = from ? addDays(from, months * DAYS_PER_MONTH) : undefined;

  function step(delta: number) {
    const next = Math.min(MAX_MONTHS, Math.max(MIN_MONTHS, months + delta));
    if (next !== months) onChange(from, next);
  }

  return (
    <div className={cn("flex w-full flex-col items-center gap-3 py-5", className)}>
      {/* Heading */}
      <p className="text-[13px] font-semibold uppercase tracking-widest text-slate">
        I want a car for
      </p>

      {/* Stepper row */}
      <div className="flex items-center gap-3">
        {/* Ghost numbers left */}
        <div className="flex items-baseline gap-1" aria-hidden>
          {months - 2 >= MIN_MONTHS ? (
            <span className="w-6 select-none text-center text-[26px] font-extrabold text-ink opacity-10">
              {months - 2}
            </span>
          ) : (
            <span className="w-6" />
          )}
          {months - 1 >= MIN_MONTHS ? (
            <span className="w-8 select-none text-center text-[38px] font-extrabold text-ink opacity-[0.22]">
              {months - 1}
            </span>
          ) : (
            <span className="w-8" />
          )}
        </div>

        {/* Minus button */}
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={months <= MIN_MONTHS}
          aria-label="Fewer months"
          className="flex size-11 items-center justify-center rounded-full border-2 border-line text-[22px] font-bold text-ink transition-colors hover:border-slate active:scale-95 disabled:cursor-not-allowed disabled:opacity-25"
        >
          −
        </button>

        {/* Current count — large and centered */}
        <span
          className="figures w-16 text-center text-[72px] font-extrabold leading-none"
          aria-live="polite"
          aria-label={`${months} ${months === 1 ? "month" : "months"}`}
        >
          {months}
        </span>

        {/* Plus button */}
        <button
          type="button"
          onClick={() => step(1)}
          disabled={months >= MAX_MONTHS}
          aria-label="More months"
          className="flex size-11 items-center justify-center rounded-full border-2 border-line text-[22px] font-bold text-ink transition-colors hover:border-slate active:scale-95 disabled:cursor-not-allowed disabled:opacity-25"
        >
          +
        </button>

        {/* Ghost numbers right */}
        <div className="flex items-baseline gap-1" aria-hidden>
          {months + 1 <= MAX_MONTHS ? (
            <span className="w-8 select-none text-center text-[38px] font-extrabold text-ink opacity-[0.22]">
              {months + 1}
            </span>
          ) : (
            <span className="w-8" />
          )}
          {months + 2 <= MAX_MONTHS ? (
            <span className="w-6 select-none text-center text-[26px] font-extrabold text-ink opacity-10">
              {months + 2}
            </span>
          ) : (
            <span className="w-6" />
          )}
        </div>
      </div>

      {/* "month / months" label */}
      <p className="text-[16px] font-semibold">{months === 1 ? "month" : "months"}</p>

      {/* Date range: clickable start date → return date */}
      <div className="flex items-center gap-2 text-[15px]">
        <Popover open={openCal} onOpenChange={setOpenCal}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                "font-semibold transition-opacity hover:opacity-60",
                from
                  ? "underline decoration-slate underline-offset-2"
                  : "text-slate"
              )}
            >
              {from ? formatDay(zonedInstant(from)) : "Pick a start date"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-auto p-2">
            <Calendar
              mode="single"
              selected={from ? keyToLocalDate(from) : undefined}
              onSelect={(date) => {
                onChange(date ? localDateToKey(date) : undefined, months);
                if (date) setOpenCal(false);
              }}
              defaultMonth={from ? keyToLocalDate(from) : undefined}
              disabled={(date) => localDateToKey(date) < today}
              className="p-1 [--cell-size:--spacing(10)]"
            />
          </PopoverContent>
        </Popover>

        {until ? (
          <>
            <span className="text-slate">to</span>
            <span className="font-semibold">{formatDay(zonedInstant(until))}</span>
          </>
        ) : (
          <span className="text-sm text-slate">— pick a date above</span>
        )}
      </div>
    </div>
  );
}
