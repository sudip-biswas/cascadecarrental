"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarX, CarFront, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cn,
  formatPrice,
  formatRange,
  formatDate,
  pluralize,
  zonedInstant,
} from "@/lib/utils";
import { addDays, daysBetween, occupantsByDay, OCCUPANT_FILL, type Occupant } from "./days";
import { BlockDateModal } from "./BlockDateModal";
import { LegendItem } from "./bits";
import { CalendarToolbar } from "./calendar/CalendarToolbar";
import { DateJump } from "./calendar/DateJump";
import {
  applyFilters,
  NO_FILTERS,
  readFilters,
  STATUS_LABEL,
  writeFilters,
  type CalendarFilters,
  type FilterableCar,
} from "./calendar/filters";
import type { PriceChanges } from "@/lib/pricing";

export interface MultiCalendarCar extends FilterableCar {
  cover: string | null;
  occupants: Occupant[];
}

/** priceOverrides[vehicleId][dateKey] = price_cents */
export type PriceOverrides = Record<string, Record<string, number>>;

/** The car column is narrower on phones so a few days still fit beside it. */
const CAR_COL = "[--car-col:140px] sm:[--car-col:212px]";
const CAR_COL_W = "var(--car-col)";
const DAY_COL_W = 76;
const WINDOW_DAYS = 90;
const ROW_H = 72;

function makeDates(start: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

function headerLabel(dateKey: string): { day: string; num: number; monthMark: string | null } {
  const d = new Date(`${dateKey}T12:00:00Z`);
  const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const num = d.getUTCDate();
  const monthMark =
    num === 1
      ? d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })
      : null;
  return { day, num, monthMark };
}

/** A rectangle of the grid: car rows r0 to r1 (indexes into cars) and days from to to. */
type Sel = { r0: number; r1: number; from: string; to: string };
type Cell = { row: number; key: string };
/** anchor is set while dragging; origin is the corner shift-click extends from. */
type Picking = { selection: Sel | null; anchor: Cell | null; origin: Cell | null };

function rect(a: Cell, b: Cell): Sel {
  return {
    r0: Math.min(a.row, b.row),
    r1: Math.max(a.row, b.row),
    from: a.key < b.key ? a.key : b.key,
    to: a.key < b.key ? b.key : a.key,
  };
}

type PriceMode = "set" | "raise" | "lower";

export function MultiCalendar({
  cars: allCars,
  today,
  horizon,
  priceOverrides: initial,
}: {
  cars: MultiCalendarCar[];
  today: string;
  /** The last day prices are loaded for; the window doesn't scroll past it. */
  horizon: string;
  priceOverrides: PriceOverrides;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const lastStart = addDays(horizon, -(WINDOW_DAYS - 1));

  // Search, sort and filters, read from the link once and written back as they change.
  // Filtering happens here, on cars already loaded, so it's instant.
  const [filters, setFilters] = useState<CalendarFilters>(() => readFilters(params));
  const cars = useMemo(() => applyFilters(allCars, filters), [allCars, filters]);

  // Dates window
  // Opens on today, or the day in the link; the back arrow reaches earlier days.
  const [windowStart, setWindowStart] = useState(() => {
    const from = params.get("from");
    return from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? (from > lastStart ? lastStart : from) : today;
  });
  const jumpTo = (key: string) => setWindowStart(key > lastStart ? lastStart : key);

  useEffect(() => {
    const next = writeFilters(new URLSearchParams(window.location.search), filters);
    if (windowStart === today) next.delete("from");
    else next.set("from", windowStart);
    const qs = next.toString();
    if (qs !== window.location.search.replace(/^\?/, "")) {
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    }
  }, [filters, windowStart, today]);

  const dates = useMemo(() => makeDates(windowStart, WINDOW_DAYS), [windowStart]);
  const headers = useMemo(() => dates.map(headerLabel), [dates]);
  const dayNames = useMemo(
    () =>
      new Map(
        dates.map((dk) => [dk, formatDate(zonedInstant(dk), { weekday: "long", year: undefined })])
      ),
    [dates]
  );

  // Who holds each car on each day, worked out once per window rather than per cell.
  // Starts a day early so a stay that began before the window doesn't get relabelled.
  const occupancy = useMemo(
    () =>
      new Map(
        cars.map((c) => [
          c.id,
          occupantsByDay(c.occupants, addDays(dates[0], -1), dates[dates.length - 1]),
        ])
      ),
    [cars, dates]
  );

  // Selection: any block of cars and days. One state, so the handlers below stay stable
  // and a drag only re-renders the rows it crosses.
  const [{ selection }, setPick] = useState<Picking>({ selection: null, anchor: null, origin: null });
  const clearSelection = () => setPick({ selection: null, anchor: null, origin: null });

  /** Rows shift when the list changes, so a selection made before would point at other cars. */
  function changeFilters(next: CalendarFilters) {
    setFilters(next);
    clearSelection();
  }

  // Right panel
  const [activeTab, setActiveTab] = useState<"prices" | "availability" | "trips">("prices");
  const [blocking, setBlocking] = useState(false);

  // Price overrides (client-side cache updated after saves)
  const [overrides, setOverrides] = useState<PriceOverrides>(initial);
  const [priceMode, setPriceMode] = useState<PriceMode>("set");
  const [priceInput, setPriceInput] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  useEffect(() => {
    const stop = () => setPick((p) => (p.anchor ? { ...p, anchor: null } : p));
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  const selCars = selection ? cars.slice(selection.r0, selection.r1 + 1) : [];
  const selectedDays = selection ? daysBetween(selection.from, selection.to) + 1 : 0;

  /** What's on the selected days, car by car. */
  const selBusy = selCars.map((car) => {
    const byDay = occupantsByDay(car.occupants, selection!.from, selection!.to);
    return { car, occupants: [...new Set(byDay.values())] };
  });
  const selOccupants = selBusy.flatMap(({ car, occupants }) => occupants.map((o) => ({ car, o })));
  const freeCars = selBusy.filter((b) => b.occupants.length === 0).map((b) => b.car);

  /** Lowest and highest daily price across the selection. */
  const priceSpan = (() => {
    if (!selection) return null;
    let lo = Infinity;
    let hi = 0;
    for (const car of selCars) {
      for (let d = selection.from; d <= selection.to; d = addDays(d, 1)) {
        const cents = overrides[car.id]?.[d] ?? car.dailyRateCents;
        lo = Math.min(lo, cents);
        hi = Math.max(hi, cents);
      }
    }
    return { lo, hi };
  })();

  const startAt = useCallback((row: number, key: string, extend: boolean) => {
    setPick(({ selection, anchor, origin }) => {
      // Shift-click stretches the selection from where it started
      if (extend && origin) return { selection: rect(origin, { row, key }), anchor: null, origin };
      // Second tap on a different day in the same car extends the range
      if (
        selection &&
        selection.r0 === row &&
        selection.r1 === row &&
        selection.from === selection.to &&
        key !== selection.from &&
        !anchor
      ) {
        return { selection: rect({ row, key: selection.from }, { row, key }), anchor: null, origin };
      }
      const cell = { row, key };
      return { selection: rect(cell, cell), anchor: cell, origin: cell };
    });
  }, []);

  const dragTo = useCallback((row: number, key: string) => {
    setPick((p) => {
      if (!p.anchor) return p;
      const next = rect(p.anchor, { row, key });
      const s = p.selection;
      if (s && s.r0 === next.r0 && s.r1 === next.r1 && s.from === next.from && s.to === next.to) return p;
      return { ...p, selection: next };
    });
  }, []);

  /** A date header picks that day for every car; shift-click stretches it. */
  function selectDay(key: string, extend: boolean) {
    const last = cars.length - 1;
    setPick(({ origin }) => {
      const corner = extend && origin ? origin : { row: 0, key };
      return {
        selection: { ...rect({ row: 0, key: corner.key }, { row: last, key }), r0: 0, r1: last },
        anchor: null,
        origin: corner,
      };
    });
  }

  async function changePrices(change: { kind: "set"; cents: number } | { kind: "adjust"; pct: number } | { kind: "reset" }) {
    if (!selection) return;
    setSavingPrice(true);
    const res = await fetch("/api/vehicles/daily-prices", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleIds: selCars.map((c) => c.id),
        from: selection.from,
        to: selection.to,
        change,
      }),
    });
    setSavingPrice(false);
    const body: { error?: string; changes?: PriceChanges } = await res.json().catch(() => ({}));
    if (!res.ok || !body.changes) {
      toast.error(body.error ?? "Couldn't save prices.");
      return false;
    }
    setOverrides((prev) => {
      const next = { ...prev };
      for (const [carId, days] of Object.entries(body.changes!)) {
        const car = { ...(next[carId] ?? {}) };
        for (const [d, cents] of Object.entries(days)) {
          if (cents === null) delete car[d];
          else car[d] = cents;
        }
        next[carId] = car;
      }
      return next;
    });
    return true;
  }

  async function savePrice() {
    const value = parseFloat(priceInput);
    const where = `${pluralize(selectedDays, "day")}${selCars.length > 1 ? ` on ${pluralize(selCars.length, "car")}` : ""}`;
    if (priceMode === "set") {
      const cents = Math.round(value * 100);
      if (isNaN(cents) || cents < 100) {
        toast.error("Enter a price of at least $1.");
        return;
      }
      if (await changePrices({ kind: "set", cents })) {
        toast.success(`${formatPrice(cents)}/day set for ${where}.`);
        setPriceInput("");
      }
      return;
    }
    if (isNaN(value) || value <= 0 || (priceMode === "lower" && value > 90)) {
      toast.error(priceMode === "lower" ? "Lower by 1% to 90%." : "Enter a percentage above 0.");
      return;
    }
    const pct = priceMode === "raise" ? value : -value;
    if (await changePrices({ kind: "adjust", pct })) {
      toast.success(`Prices ${pct > 0 ? "raised" : "lowered"} ${Math.abs(pct)}% for ${where}.`);
      setPriceInput("");
    }
  }

  async function resetPrice() {
    if (await changePrices({ kind: "reset" })) toast.success("Reset to the daily rate.");
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="headline text-[clamp(46px,6vw,72px)]">Calendar</h1>

      <CalendarToolbar
        cars={allCars}
        filters={filters}
        onChange={changeFilters}
        onPrev={() => setWindowStart((s) => addDays(s, -14))}
        onNext={() => jumpTo(addDays(windowStart, 14))}
        canNext={windowStart < lastStart}
        onToday={windowStart === today ? null : () => setWindowStart(today)}
      />

      <div className="flex flex-wrap items-start gap-4">
        {/* ── Grid ─────────────────────────────────────────── */}
        <div className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-[24px] bg-white">
          <div className={cn("overflow-auto", CAR_COL)} style={{ maxHeight: "calc(100vh - 234px)" }}>
            {/* Inner div sets the total width so horizontal scroll works */}
            <div style={{ minWidth: `calc(${CAR_COL_W} + ${dates.length * DAY_COL_W}px)` }}>

              {/* ── Date header (sticky top) ── */}
              <div
                className="sticky top-0 z-20 flex border-b border-line bg-white"
              >
                {/* Corner – month and date pickers */}
                <div
                  className="sticky left-0 z-30 flex shrink-0 items-center border-r border-line bg-white px-1.5 py-2 sm:px-2"
                  style={{ width: CAR_COL_W }}
                >
                  <DateJump start={windowStart} today={today} horizon={horizon} onJump={jumpTo} />
                </div>

                {/* Date columns */}
                {dates.map((dk, i) => {
                  const { day, num, monthMark } = headers[i];
                  const isToday = dk === today;
                  return (
                    <button
                      key={dk}
                      type="button"
                      onClick={(e) => selectDay(dk, e.shiftKey)}
                      aria-label={`Select ${dayNames.get(dk)} for every car`}
                      className="relative flex shrink-0 select-none flex-col items-center justify-end border-r border-line pb-1.5 pt-5 transition-colors last:border-r-0 hover:bg-board"
                      style={{ width: DAY_COL_W }}
                    >
                      {monthMark && (
                        <span className="absolute left-0 right-0 top-0.5 truncate text-center text-[10px] font-bold text-slate">
                          {monthMark}
                        </span>
                      )}
                      <span className={cn("text-[11px] font-semibold", isToday ? "text-cobalt" : "text-quiet")}>
                        {day}
                      </span>
                      <span
                        className={cn(
                          "flex size-6 items-center justify-center rounded-full text-[13px] font-extrabold",
                          isToday ? "bg-ink text-white" : "text-ink"
                        )}
                      >
                        {num}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* ── Car rows ── */}
              {cars.map((car, row) => {
                const selected = !!selection && row >= selection.r0 && row <= selection.r1;
                return (
                  <CarRow
                    key={car.id}
                    row={row}
                    car={car}
                    dates={dates}
                    dayNames={dayNames}
                    today={today}
                    occupancy={occupancy.get(car.id)!}
                    prices={overrides[car.id]}
                    selFrom={selected ? selection.from : null}
                    selTo={selected ? selection.to : null}
                    onStart={startAt}
                    onDrag={dragTo}
                  />
                );
              })}
            </div>
          </div>

          {cars.length === 0 && (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-[14px] bg-board">
                <SearchX className="size-6" />
              </span>
              <h2 className="text-[22px] leading-tight font-extrabold">No cars found</h2>
              <p className="text-[15px] text-slate">Try changing or resetting your filters.</p>
              <Button variant="secondary" onClick={() => changeFilters({ ...NO_FILTERS, sort: filters.sort })}>
                Reset filters
              </Button>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-sm text-slate">
            <LegendItem swatch="bg-ink" label="Booked" />
            <LegendItem swatch="bg-butter" label="Request" />
            <LegendItem swatch="bg-[#c9ccd3]" label="Blocked" />
            <LegendItem swatch="bg-sky" label="Selected" />
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-cobalt" />
              Custom price
            </span>
          </div>
        </div>

        {/* ── Right panel ──────────────────────────────────── */}
        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-3 rounded-[30px] bg-white p-5">
          {selection && selCars.length > 0 ? (
            <>
              <div>
                <h2 className="text-[18px] font-extrabold leading-tight">
                  {selCars.length === 1 ? selCars[0].name : pluralize(selCars.length, "car")}
                </h2>
                <p className="mt-0.5 text-[13px] text-slate">
                  {selection.from === selection.to
                    ? formatDate(zonedInstant(selection.from), { year: undefined })
                    : formatRange(zonedInstant(selection.from), zonedInstant(selection.to))}
                  {" · "}
                  {pluralize(selectedDays, "day")}
                </p>
              </div>

              {/* Tab bar */}
              <div className="flex gap-1 rounded-[12px] bg-board p-1">
                {(["prices", "availability", "trips"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-1 rounded-[9px] py-1.5 text-[12px] font-bold capitalize transition-colors",
                      activeTab === tab
                        ? "bg-white text-ink shadow-sm"
                        : "text-slate hover:text-ink"
                    )}
                  >
                    {tab === "availability" ? "Avail." : tab[0].toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Prices tab */}
              {activeTab === "prices" && (
                <div className="flex flex-col gap-3">
                  <p className="text-[13px] text-slate">
                    {selCars.length === 1 ? (
                      <>
                        Base rate:{" "}
                        <strong className="text-ink">{formatPrice(selCars[0].dailyRateCents)}/day</strong>
                        {" · "}
                      </>
                    ) : null}
                    Now{" "}
                    <strong className="text-ink">
                      {priceSpan && priceSpan.lo !== priceSpan.hi
                        ? `${formatPrice(priceSpan.lo)} – ${formatPrice(priceSpan.hi)}`
                        : formatPrice(priceSpan?.lo ?? 0)}
                    </strong>
                  </p>
                  <div className="flex gap-1 rounded-[12px] bg-board p-1" role="radiogroup" aria-label="How to change prices">
                    {(
                      [
                        ["set", "Set to"],
                        ["raise", "Raise by"],
                        ["lower", "Lower by"],
                      ] as const
                    ).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        role="radio"
                        aria-checked={priceMode === mode}
                        onClick={() => setPriceMode(mode)}
                        className={cn(
                          "flex-1 rounded-[9px] py-1.5 text-[12px] font-bold transition-colors",
                          priceMode === mode ? "bg-white text-ink shadow-sm" : "text-slate hover:text-ink"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="price-input" className="text-sm font-semibold">
                      {priceMode === "set" ? "Price a day, in dollars" : "Percent"}
                    </Label>
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        savePrice();
                      }}
                    >
                      <Input
                        id="price-input"
                        type="number"
                        min="1"
                        max={priceMode === "lower" ? 90 : undefined}
                        step="1"
                        placeholder={
                          priceMode === "set"
                            ? (selCars[0].dailyRateCents / 100).toFixed(0)
                            : "10"
                        }
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        className="flex-1"
                      />
                      <Button type="submit" disabled={savingPrice || !priceInput}>
                        {savingPrice ? "…" : "Apply"}
                      </Button>
                    </form>
                    {priceMode !== "set" && (
                      <p className="text-[12px] text-slate">Each day moves from its own price, rounded to whole dollars.</p>
                    )}
                  </div>
                  <Button variant="secondary" size="sm" disabled={savingPrice} onClick={resetPrice}>
                    Reset to base rate
                  </Button>
                </div>
              )}

              {/* Availability tab */}
              {activeTab === "availability" && (
                <div className="flex flex-col gap-3">
                  {selOccupants.length > 0 ? (
                    <>
                      <p className="text-[13px] text-slate">
                        Some days already have bookings or blocks.
                      </p>
                      {selOccupants.map(({ car, o }) => (
                        <div key={o.id} className="rounded-[12px] bg-board p-3 text-[13px]">
                          <p className="font-semibold">
                            {selCars.length > 1 ? `${car.name} · ` : ""}
                            {o.label}
                          </p>
                          <p className="mt-0.5 text-slate">
                            {formatRange(new Date(o.start), new Date(o.end))}
                          </p>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-[13px] text-slate">
                      All {pluralize(selectedDays, "day")} are open.
                    </p>
                  )}
                  {freeCars.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setBlocking(true)}
                      className="flex items-center gap-3 rounded-[18px] bg-ink p-4 text-left text-white transition-colors hover:bg-graphite"
                    >
                      <CalendarX className="size-5 shrink-0" strokeWidth={1.75} />
                      <span>
                        <span className="block text-[15px] font-extrabold">Block these days</span>
                        <span className="text-[12px] opacity-75">
                          {freeCars.length === selCars.length
                            ? "Nobody can book them"
                            : `On the ${pluralize(freeCars.length, "car")} that are free`}
                        </span>
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="self-start text-[13px] font-bold hover:text-cobalt"
                  >
                    Clear selection
                  </button>
                </div>
              )}

              {/* Trips tab */}
              {activeTab === "trips" && (
                <div className="flex flex-col gap-2">
                  {selOccupants.length === 0 ? (
                    <p className="text-[13px] text-slate">No trips or blocks on these days.</p>
                  ) : (
                    selOccupants.map(({ car, o }) => (
                      <div key={o.id} className="rounded-[12px] bg-board p-3 text-[13px]">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-2 shrink-0 rounded-full",
                              o.kind === "booked"
                                ? "bg-ink"
                                : o.kind === "request"
                                  ? "bg-butter"
                                  : "bg-[#c9ccd3]"
                            )}
                          />
                          <p className="font-semibold">
                            {selCars.length > 1 ? `${car.name} · ` : ""}
                            {o.label}
                          </p>
                        </div>
                        <p className="mt-0.5 text-slate">
                          {formatRange(new Date(o.start), new Date(o.end))}
                        </p>
                        {o.kind !== "blocked" && (
                          <Link
                            href={`/host/trips/${o.id}`}
                            className="mt-1.5 inline-block text-cobalt font-semibold hover:underline"
                          >
                            View trip →
                          </Link>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-[22px] font-extrabold">Your calendar</h2>
              <p className="text-[14px] text-slate">
                Click a day on any car to select it, and drag across days and cars to select more.
                Shift-click to stretch a selection, or click a date at the top to pick it for every
                car. Then set prices, block days, or view trips here.
              </p>
              <p className="rounded-[18px] bg-sky p-3.5 text-[13px] leading-[1.45] text-sky-ink">
                Tip: on mobile, tap the first day then tap the last day to select a range.
              </p>
            </>
          )}
        </aside>
      </div>

      {selection && blocking && freeCars.length > 0 && (
        <BlockDateModal
          key={`${selection.r0}-${selection.r1}-${selection.from}-${selection.to}`}
          open={blocking}
          onOpenChange={setBlocking}
          cars={freeCars.map((c) => ({ id: c.id, name: c.name }))}
          from={selection.from}
          to={selection.to}
          onBlocked={() => {
            clearSelection();
            setBlocking(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/** One car's row. Memoised so selecting or dragging only redraws the rows that change. */
const CarRow = memo(function CarRow({
  row,
  car,
  dates,
  dayNames,
  today,
  occupancy,
  prices,
  selFrom,
  selTo,
  onStart,
  onDrag,
}: {
  row: number;
  car: MultiCalendarCar;
  dates: string[];
  dayNames: Map<string, string>;
  today: string;
  occupancy: Map<string, Occupant>;
  prices: Record<string, number> | undefined;
  selFrom: string | null;
  selTo: string | null;
  onStart: (row: number, key: string, extend: boolean) => void;
  onDrag: (row: number, key: string) => void;
}) {
  return (
    <div className="flex border-b border-line last:border-b-0">
      {/* Car label (sticky left) */}
      <div
        className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-line bg-white px-2.5 py-2"
        style={{ width: CAR_COL_W, minHeight: ROW_H }}
      >
        <Link href={`/host/vehicles/${car.id}`} className="hidden shrink-0 sm:block">
          {car.cover ? (
            <Image
              src={car.cover}
              alt={car.name}
              width={52}
              height={40}
              className="rounded-[8px] object-cover"
              style={{ width: 52, height: 40 }}
            />
          ) : (
            <span className="flex h-[40px] w-[52px] items-center justify-center rounded-[8px] bg-board text-quiet">
              <CarFront className="size-5" strokeWidth={1.5} />
            </span>
          )}
        </Link>
        <Link href={`/host/vehicles/${car.id}`} className="group min-w-0 leading-tight">
          <span className="line-clamp-2 text-[12px] font-bold group-hover:text-cobalt">
            {car.name} {car.year}
          </span>
          <span className="mt-0.5 block truncate text-[11px] font-semibold text-quiet">
            {car.plate}
            {car.status !== "listed" && ` · ${STATUS_LABEL[car.status]}`}
          </span>
        </Link>
      </div>

      {/* Date cells */}
      {dates.map((dk) => {
        const occupant = occupancy.get(dk);
        const past = dk < today;
        const isSelected = selFrom !== null && selTo !== null && dk >= selFrom && dk <= selTo;
        const price = prices?.[dk] ?? car.dailyRateCents;
        const hasCustomPrice = prices?.[dk] != null;
        // Show occupant start label only at the first day it appears in the window
        const prevOccupant = occupancy.get(addDays(dk, -1));
        const occupantStarts = occupant && occupant.id !== prevOccupant?.id;

        return (
          <button
            key={dk}
            type="button"
            onPointerDown={(e) => onStart(row, dk, e.shiftKey)}
            onPointerEnter={() => onDrag(row, dk)}
            aria-pressed={isSelected}
            aria-label={`${car.name} ${dayNames.get(dk)}${occupant ? `, ${occupant.label}` : `, ${formatPrice(price)}`}`}
            className={cn(
              "relative flex shrink-0 cursor-pointer select-none flex-col items-center justify-center gap-0.5 border-r border-line transition-colors last:border-r-0",
              occupant
                ? OCCUPANT_FILL[occupant.kind]
                : isSelected
                  ? "bg-sky text-sky-ink"
                  : past
                    ? "bg-board/40 text-quiet"
                    : "bg-white hover:bg-sky/20"
            )}
            style={{ width: DAY_COL_W, minHeight: ROW_H }}
          >
            {occupant ? (
              <span className="px-1 text-center text-[11px] font-semibold leading-tight">
                {occupantStarts ? occupant.label : ""}
              </span>
            ) : (
              <>
                <span className="text-[13px] font-bold">{formatPrice(price)}</span>
                {hasCustomPrice && !past && (
                  <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-cobalt" />
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
});
