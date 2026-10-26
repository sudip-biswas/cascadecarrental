"use client";

import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { keyToLocalDate, localDateToKey, todayKey, type DateKey } from "@/components/search/dates";
import { formatDay, zonedInstant } from "@/lib/utils";

const TIME_STEPS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Just the return day and time, for a trip that has already started. Looks like TripDatesPicker. */
export function ReturnPicker({
  start,
  until,
  untilTime,
  booked,
  onChange,
}: {
  start: DateKey;
  until?: DateKey;
  untilTime: string;
  booked: Set<DateKey>;
  onChange: (until: DateKey | undefined, time: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const earliest = todayKey() > start ? todayKey() : start;
  const times = TIME_STEPS.includes(untilTime) ? TIME_STEPS : [...TIME_STEPS, untilTime].sort();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex w-full flex-col rounded-[16px] bg-board px-4 py-2 text-left outline-none transition-colors hover:bg-line focus-visible:ring-2 focus-visible:ring-ink"
        >
          <span className="text-[13px] font-semibold text-slate">Return</span>
          <span className="text-base leading-snug font-bold">{until ? formatDay(zonedInstant(until)) : "Add date"}</span>
          <span className="text-[12px] leading-snug text-slate">{formatTime(untilTime)}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <Calendar
          mode="single"
          selected={until ? keyToLocalDate(until) : undefined}
          onSelect={(date) => onChange(date ? localDateToKey(date) : undefined, untilTime)}
          defaultMonth={until ? keyToLocalDate(until) : undefined}
          disabled={(date) => localDateToKey(date) < earliest}
          modifiers={{ booked: (date) => booked.has(localDateToKey(date)) }}
          modifiersClassNames={{ booked: "[&_button]:line-through [&_button]:text-quiet" }}
          className="p-1 [--cell-size:--spacing(10)]"
        />
        <div className="flex flex-col gap-1 px-2 pt-2 pb-1">
          <span className="text-[12px] font-semibold text-slate">Return time</span>
          <select
            value={untilTime}
            onChange={(e) => onChange(until, e.target.value)}
            className="rounded-[10px] bg-board px-3 py-2 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-ink"
          >
            {times.map((t) => (
              <option key={t} value={t}>
                {formatTime(t)}
              </option>
            ))}
          </select>
        </div>
      </PopoverContent>
    </Popover>
  );
}
