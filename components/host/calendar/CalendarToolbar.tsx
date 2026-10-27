"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Info, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, pluralize } from "@/lib/utils";
import { LegendItem } from "../bits";
import {
  activeCount,
  applyFilters,
  NO_FILTERS,
  SORTS,
  STATUS_LABEL,
  type CalendarFilters,
  type CalendarSort,
  type FilterableCar,
  type ListingStatus,
} from "./filters";

const chip =
  "flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] px-3 text-[14px] font-bold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cobalt";

function chipTone(active: boolean) {
  return active ? "bg-ink text-white hover:bg-graphite" : "bg-white text-ink hover:bg-line";
}

const iconBtn =
  "flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-ink transition-colors outline-none hover:bg-line focus-visible:ring-2 focus-visible:ring-cobalt disabled:opacity-40 disabled:hover:bg-white";

type Option = { value: string; label: string; hint?: string };

/** Search, sort and filters over the host's cars, plus the arrows that move the dates. */
export function CalendarToolbar({
  cars,
  filters,
  onChange,
  onPrev,
  onNext,
  canNext,
  onToday,
}: {
  cars: FilterableCar[];
  filters: CalendarFilters;
  onChange: (next: CalendarFilters) => void;
  onPrev: () => void;
  onNext: () => void;
  canNext: boolean;
  /** Set when the dates have moved off today. */
  onToday: (() => void) | null;
}) {
  const set = (patch: Partial<CalendarFilters>) => onChange({ ...filters, ...patch });
  const countFor = (patch: Partial<CalendarFilters>) => applyFilters(cars, { ...filters, ...patch }).length;
  const shown = countFor({});
  const narrowed = activeCount(filters) > 0;

  const statuses = (["listed", "unlisted", "suspended"] as ListingStatus[]).filter(
    (s) => s !== "suspended" || cars.some((c) => c.status === s)
  );
  const cities = [...new Set(cars.map((c) => c.city))].sort((a, b) => a.localeCompare(b));
  const tally = (pick: (c: FilterableCar) => string, value: string) =>
    String(cars.filter((c) => pick(c) === value).length);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <Popover>
          <PopoverTrigger className={iconBtn} aria-label="How the calendar works">
            <Info className="size-[18px]" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 gap-3 p-4">
            <p className="text-[16px] font-extrabold">How the calendar works</p>
            <p className="text-[13px] leading-[1.45] text-slate">
              Each row is a car and each column is a day. Pick days to change prices, block them or see
              trips. Drag across cars to change several at once.
            </p>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <LegendItem swatch="bg-ink" label="Booked trip" />
              <LegendItem swatch="bg-butter" label="Trip request" />
              <LegendItem swatch="bg-[#c9ccd3]" label="Blocked by you" />
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-cobalt" />
                Custom price
              </span>
            </div>
            <p className="text-[13px] leading-[1.45] text-slate">
              Search and filters stay in the link, so a reload or a shared link keeps the same view.
            </p>
          </PopoverContent>
        </Popover>
        <button type="button" onClick={onPrev} aria-label="Earlier days" className={iconBtn}>
          <ChevronLeft className="size-[18px]" />
        </button>
        <button type="button" onClick={onNext} disabled={!canNext} aria-label="Later days" className={iconBtn}>
          <ChevronRight className="size-[18px]" />
        </button>
        {onToday && (
          <button type="button" onClick={onToday} className={cn(chip, chipTone(false))}>
            Today
          </button>
        )}
      </div>

      <label className="relative flex h-10 min-w-0 flex-1 items-center sm:max-w-[280px] xl:ml-auto">
        <Search className="pointer-events-none absolute left-3 size-4 text-quiet" />
        <input
          type="search"
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Make, model, plate"
          aria-label="Search cars"
          className="h-full w-full rounded-[12px] bg-white pr-9 pl-9 text-[14px] font-semibold text-ink outline-none placeholder:font-medium placeholder:text-quiet focus-visible:ring-2 focus-visible:ring-ink [&::-webkit-search-cancel-button]:hidden"
        />
        {filters.q && (
          <button
            type="button"
            onClick={() => set({ q: "" })}
            aria-label="Clear search"
            className="absolute right-2 rounded-[8px] p-1 text-quiet hover:text-ink"
          >
            <X className="size-4" />
          </button>
        )}
      </label>

      <div className="-mx-4 flex w-[calc(100%+2rem)] items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 sm:pb-0">
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(chip, chipTone(filters.sort !== "added"))}>
            {filters.sort === "added" ? "Sort" : SORTS.find((s) => s.value === filters.sort)?.label}
            <ChevronDown className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuRadioGroup value={filters.sort} onValueChange={(v) => set({ sort: v as CalendarSort })}>
              {SORTS.map((s) => (
                <DropdownMenuRadioItem key={s.value} value={s.value}>
                  {s.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <FilterPopover
          label="Listing status"
          options={statuses.map((s) => ({
            value: s,
            label: STATUS_LABEL[s],
            hint: tally((c) => c.status, s),
          }))}
          selected={filters.status}
          onApply={(status) => set({ status })}
          countFor={(status) => countFor({ status })}
        />
        <FilterPopover
          label="Car"
          options={cars.map((c) => ({ value: c.id, label: c.name, hint: `${c.year} · ${c.plate}` }))}
          selected={filters.cars}
          onApply={(ids) => set({ cars: ids })}
          countFor={(ids) => countFor({ cars: ids })}
          wide
        />
        <FilterPopover
          label="City"
          options={cities.map((city) => ({ value: city, label: city, hint: tally((c) => c.city, city) }))}
          selected={filters.cities}
          onApply={(list) => set({ cities: list })}
          countFor={(list) => countFor({ cities: list })}
        />

        {narrowed && (
          <span className="flex shrink-0 items-center gap-1 pl-1 text-[13px] text-slate">
            {shown} of {pluralize(cars.length, "car")}
            <button
              type="button"
              onClick={() => onChange({ ...NO_FILTERS, sort: filters.sort })}
              className="rounded-[8px] px-1.5 py-1 font-bold text-ink hover:text-cobalt"
            >
              Reset
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

/** A filter chip with checkboxes. Ticks are a draft until "Show cars", like Turo's. */
function FilterPopover({
  label,
  options,
  selected,
  onApply,
  countFor,
  wide,
}: {
  label: string;
  options: Option[];
  selected: string[];
  onApply: (values: string[]) => void;
  countFor: (values: string[]) => number;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(selected);
  const result = countFor(draft);

  function toggle(value: string) {
    setDraft((d) => (d.includes(value) ? d.filter((v) => v !== value) : [...d, value]));
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(selected);
        setOpen(next);
      }}
    >
      <PopoverTrigger className={cn(chip, chipTone(selected.length > 0))}>
        {label}
        {selected.length > 0 && ` (${selected.length})`}
        <ChevronDown className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="end" className={cn("gap-1 p-2", wide ? "w-80" : "w-64")}>
        <div className="flex max-h-[min(340px,50vh)] flex-col overflow-y-auto">
          {options.map((o) => {
            const checked = draft.includes(o.value);
            return (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-3 rounded-[12px] px-2.5 py-2 text-[14px] hover:bg-board"
              >
                <Checkbox checked={checked} onCheckedChange={() => toggle(o.value)} />
                <span className="min-w-0 flex-1 truncate font-semibold">{o.label}</span>
                {o.hint && <span className="shrink-0 text-[12px] text-quiet">{o.hint}</span>}
              </label>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line px-1 pt-2">
          <button
            type="button"
            onClick={() => setDraft([])}
            disabled={draft.length === 0}
            className="rounded-[8px] px-2 py-1.5 text-[14px] font-bold hover:text-cobalt disabled:text-quiet"
          >
            Reset
          </button>
          <Button
            size="sm"
            disabled={result === 0}
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            {result === 0 ? "No cars match" : `Show ${pluralize(result, "car")}`}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
