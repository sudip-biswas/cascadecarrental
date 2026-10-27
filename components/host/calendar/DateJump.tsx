"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { keyToLocalDate, localDateToKey } from "@/components/search/dates";

function monthName(key: string, month: "long" | "short" = "long") {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", {
    month,
    year: "numeric",
    timeZone: "UTC",
  });
}

/** First of each month from a month back to the last month prices reach. */
function monthStarts(today: string, horizon: string): string[] {
  const out: string[] = [];
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7)) - 1;
  if (m === 0) {
    m = 12;
    y -= 1;
  }
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}-01`;
    if (key > horizon) return out;
    out.push(key);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
}

/** Month picker and a date picker that move the calendar's first column. */
export function DateJump({
  start,
  today,
  horizon,
  onJump,
}: {
  start: string;
  today: string;
  horizon: string;
  onJump: (dateKey: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const months = monthStarts(today, horizon);
  const current = start.slice(0, 8) + "01";

  return (
    <div className="flex w-full items-center justify-between gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex min-w-0 items-center gap-0.5 rounded-[8px] px-1 py-1 text-[13px] sm:gap-1 sm:px-1.5 font-extrabold text-cobalt outline-none hover:bg-board focus-visible:ring-2 focus-visible:ring-cobalt">
          <span className="truncate sm:hidden">{monthName(start, "short")}</span>
          <span className="hidden truncate sm:inline">{monthName(start)}</span>
          <ChevronDown className="size-3.5 shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 w-48">
          <DropdownMenuRadioGroup value={current} onValueChange={(v) => onJump(v < today && v.slice(0, 7) === today.slice(0, 7) ? today : v)}>
            {months.map((m) => (
              <DropdownMenuRadioItem key={m} value={m}>
                {monthName(m)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label="Go to a date"
          className="flex size-7 shrink-0 items-center justify-center rounded-[8px] text-ink outline-none hover:bg-board focus-visible:ring-2 focus-visible:ring-cobalt"
        >
          <CalendarDays className="size-[18px]" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <Calendar
            mode="single"
            selected={keyToLocalDate(start)}
            defaultMonth={keyToLocalDate(start)}
            onSelect={(date) => {
              if (!date) return;
              onJump(localDateToKey(date));
              setOpen(false);
            }}
            disabled={(date) => localDateToKey(date) > horizon}
            className="p-1 [--cell-size:--spacing(10)]"
          />
          <div className="flex items-center justify-between px-2 pt-1 pb-1 text-sm">
            <span className="text-slate">Pick the first day to show.</span>
            <button
              type="button"
              className="font-bold hover:text-cobalt"
              onClick={() => {
                onJump(today);
                setOpen(false);
              }}
            >
              Today
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
