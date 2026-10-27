"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDay, zonedInstant } from "@/lib/utils";
import { DEFAULT_TIME, keyToLocalDate, localDateToKey, todayKey, type DateKey } from "./dates";

const TIME_STEPS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

interface Props {
  from?: DateKey;
  until?: DateKey;
  fromTime?: string;
  untilTime?: string;
  onChange: (from: DateKey | undefined, until: DateKey | undefined) => void;
  onTimeChange?: (fromTime: string, untilTime: string) => void;
  /** Days that can't be picked at all, e.g. inside the host's notice window. */
  isDisabled?: (key: DateKey) => boolean;
  /** The times a guest can pick on a date, e.g. inside the host's pickup hours. All by default. */
  timeOptions?: (key: DateKey | undefined) => string[];
  /** Nights already taken. Shown struck through. */
  booked?: Set<DateKey>;
  /** Fill of the two fields: board on white tiles, white on board. */
  tone?: "board" | "white";
  /** Shown under the calendar, e.g. why a range doesn't work. */
  note?: React.ReactNode;
  className?: string;
}

function Field({
  label,
  value,
  time,
  tone,
}: {
  label: string;
  value?: DateKey;
  time: string;
  tone: "board" | "white";
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 flex-col gap-0 rounded-[16px] px-4 py-2 text-left transition-colors",
        tone === "board" ? "bg-board group-hover:bg-line" : "bg-white"
      )}
    >
      <span className="text-[13px] font-semibold text-slate">{label}</span>
      <span className={cn("truncate text-base font-bold leading-snug", !value && "text-slate")}>
        {value ? formatDay(zonedInstant(value)) : "Add date"}
      </span>
      <span className="text-[12px] text-slate leading-snug">{formatTime(time)}</span>
    </span>
  );
}

/** Pick-up and return fields that open one range calendar with optional time pickers. */
export function TripDatesPicker({
  from,
  until,
  fromTime = DEFAULT_TIME,
  untilTime = DEFAULT_TIME,
  onChange,
  onTimeChange,
  isDisabled,
  timeOptions,
  booked,
  tone = "board",
  note,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const today = todayKey();

  /** Allowed times for a date, plus the current one so the select always shows it. */
  function optionsFor(key: DateKey | undefined, current: string) {
    const times = timeOptions?.(key) ?? TIME_STEPS;
    return times.includes(current) ? times : [...times, current].sort();
  }

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
          <Field label="Pick-up" value={from} time={fromTime} tone={tone} />
          <Field label="Return" value={until} time={untilTime} tone={tone} />
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
        {onTimeChange && (
          <div className="grid grid-cols-2 gap-2 px-2 pt-2 pb-1">
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-slate">Pick-up time</span>
              <select
                value={fromTime}
                onChange={(e) => onTimeChange(e.target.value, untilTime)}
                className="rounded-[10px] bg-board px-3 py-2 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-ink"
              >
                {optionsFor(from, fromTime).map((t) => (
                  <option key={t} value={t}>{formatTime(t)}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-slate">Return time</span>
              <select
                value={untilTime}
                onChange={(e) => onTimeChange(fromTime, e.target.value)}
                className="rounded-[10px] bg-board px-3 py-2 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-ink"
              >
                {optionsFor(until, untilTime).map((t) => (
                  <option key={t} value={t}>{formatTime(t)}</option>
                ))}
              </select>
            </div>
          </div>
        )}
        <div className="flex max-w-[300px] items-center justify-between gap-3 px-2 pt-1 pb-1 text-sm">
          <span className="text-slate">
            {note ?? (from && !until ? "Now pick the return day." : undefined)}
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
