"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDay, zonedInstant } from "@/lib/utils";
import { keyToLocalDate, localDateToKey, todayKey, type DateKey } from "./dates";

interface Props {
  from?: DateKey;
  until?: DateKey;
  onChange: (from: DateKey | undefined, until: DateKey | undefined) => void;
  /** Days that can't be picked at all, e.g. inside the host's notice window. */
  isDisabled?: (key: DateKey) => boolean;
  /** Nights already taken. Shown struck through. */
  booked?: Set<DateKey>;
  /** Fill of the two fields: board on white tiles, white on board. */
  tone?: "board" | "white";
  /** Shown under the calendar, e.g. why a range doesn't work. */
  note?: React.ReactNode;
  className?: string;
}

function Field({ label, value, tone }: { label: string; value?: DateKey; tone: "board" | "white" }) {
  return (
    <span
      className={cn(
        "flex min-w-0 flex-col gap-0.5 rounded-[16px] px-4 py-2.5 text-left transition-colors",
        tone === "board" ? "bg-board group-hover:bg-line" : "bg-white"
      )}
    >
      <span className="text-[13px] font-semibold text-slate">{label}</span>
      <span className={cn("truncate text-base font-bold", !value && "text-slate")}>
        {value ? formatDay(zonedInstant(value)) : "Add date"}
      </span>
    </span>
  );
}

/** Pick-up and return fields that open one range calendar. */
export function TripDatesPicker({
  from,
  until,
  onChange,
  isDisabled,
  booked,
  tone = "board",
  note,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const today = todayKey();

  const selected: DateRange | undefined = from
    ? { from: keyToLocalDate(from), to: until ? keyToLocalDate(until) : undefined }
    : undefined;

  function handleSelect(range: DateRange | undefined) {
    const nextFrom = range?.from ? localDateToKey(range.from) : undefined;
    const rawUntil = range?.to ? localDateToKey(range.to) : undefined;
    // A single tapped day is a pick-up date, not a zero-day trip.
    const nextUntil = rawUntil && nextFrom && rawUntil > nextFrom ? rawUntil : undefined;
    onChange(nextFrom, nextUntil);
    if (nextFrom && nextUntil) setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn("group grid w-full grid-cols-2 gap-2 rounded-[16px] outline-none focus-visible:ring-2 focus-visible:ring-ink", className)}
        >
          <Field label="Pick-up" value={from} tone={tone} />
          <Field label="Return" value={until} tone={tone} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <Calendar
          mode="range"
          selected={selected}
          onSelect={handleSelect}
          defaultMonth={selected?.from}
          disabled={(date) => {
            const key = localDateToKey(date);
            return key < today || (isDisabled?.(key) ?? false);
          }}
          modifiers={booked ? { booked: (date) => booked.has(localDateToKey(date)) } : undefined}
          modifiersClassNames={{ booked: "[&_button]:line-through [&_button]:text-quiet" }}
          className="p-1 [--cell-size:--spacing(10)]"
        />
        <div className="flex max-w-[300px] items-center justify-between gap-3 px-2 pt-1 pb-1 text-sm">
          <span className="text-slate">
            {note ?? (from && !until ? "Now pick the return day." : "Pick-up and return are at 10:00.")}
          </span>
          {(from || until) && (
            <button
              type="button"
              className="shrink-0 font-bold hover:text-cobalt"
              onClick={() => onChange(undefined, undefined)}
            >
              Clear
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
