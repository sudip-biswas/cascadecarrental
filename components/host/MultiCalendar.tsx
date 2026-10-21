"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarX, CarFront, ChevronLeft, ChevronRight } from "lucide-react";
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

export interface MultiCalendarCar {
  id: string;
  name: string;
  cover: string | null;
  dailyRateCents: number;
  occupants: Occupant[];
}

/** priceOverrides[vehicleId][dateKey] = price_cents */
export type PriceOverrides = Record<string, Record<string, number>>;

const CAR_COL_W = 212;
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

type Sel = { carId: string; from: string; to: string };
type Picking = { selection: Sel | null; anchor: { carId: string; key: string } | null };

export function MultiCalendar({
  cars,
  today,
  priceOverrides: initial,
}: {
  cars: MultiCalendarCar[];
  today: string;
  priceOverrides: PriceOverrides;
}) {
  const router = useRouter();

  // Dates window
  const [windowStart, setWindowStart] = useState(() => addDays(today, -7));
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

  // Selection: one car, one date range. One state, so the handlers below stay stable
  // and a drag only re-renders the row under the pointer.
  const [{ selection }, setPick] = useState<Picking>({ selection: null, anchor: null });
  const clearSelection = () => setPick({ selection: null, anchor: null });

  // Right panel
  const [activeTab, setActiveTab] = useState<"prices" | "availability" | "trips">("prices");
  const [blocking, setBlocking] = useState(false);

  // Price overrides (client-side cache updated after saves)
  const [overrides, setOverrides] = useState<PriceOverrides>(initial);
  const [priceInput, setPriceInput] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);

  useEffect(() => {
    const stop = () => setPick((p) => (p.anchor ? { ...p, anchor: null } : p));
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  const selectedCar = selection ? cars.find((c) => c.id === selection.carId) : null;
  const selectedDays = selection ? daysBetween(selection.from, selection.to) + 1 : 0;
  const selDates = selection
    ? Array.from({ length: selectedDays }, (_, i) => addDays(selection.from, i))
    : [];

  /** All unique occupants that overlap the selection */
  const selOccupants: Occupant[] = (() => {
    if (!selection || !selectedCar) return [];
    const byDay = occupantsByDay(selectedCar.occupants, selection.from, selection.to);
    return [...new Set(selDates.map((d) => byDay.get(d)).filter((o) => o !== undefined))];
  })();

  const startAt = useCallback((carId: string, key: string) => {
    setPick(({ selection, anchor }) => {
      // Second tap on a different day in the same car extends the range
      if (
        selection?.carId === carId &&
        selection.from === selection.to &&
        key !== selection.from &&
        !anchor
      ) {
        return {
          selection: {
            carId,
            from: key < selection.from ? key : selection.from,
            to: key < selection.from ? selection.from : key,
          },
          anchor: null,
        };
      }
      return { selection: { carId, from: key, to: key }, anchor: { carId, key } };
    });
  }, []);

  const dragTo = useCallback((carId: string, key: string) => {
    setPick((p) => {
      if (!p.anchor || p.anchor.carId !== carId) return p;
      const from = key < p.anchor.key ? key : p.anchor.key;
      const to = key < p.anchor.key ? p.anchor.key : key;
      if (p.selection?.from === from && p.selection.to === to) return p;
      return { ...p, selection: { carId, from, to } };
    });
  }, []);

  async function savePrice() {
    if (!selection || !priceInput) return;
    const cents = Math.round(parseFloat(priceInput) * 100);
    if (isNaN(cents) || cents < 100) {
      toast.error("Enter a price of at least $1.");
      return;
    }
    setSavingPrice(true);
    const res = await fetch(`/api/vehicles/${selection.carId}/daily-prices`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dates: selDates, priceCents: cents }),
    });
    setSavingPrice(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
      toast.error(error ?? "Couldn't save price.");
      return;
    }
    const next = { ...overrides, [selection.carId]: { ...(overrides[selection.carId] ?? {}) } };
    for (const d of selDates) next[selection.carId][d] = cents;
    setOverrides(next);
    toast.success(`${formatPrice(cents)}/day set for ${pluralize(selectedDays, "day")}.`);
    setPriceInput("");
  }

  async function resetPrice() {
    if (!selection) return;
    setSavingPrice(true);
    const res = await fetch(`/api/vehicles/${selection.carId}/daily-prices`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dates: selDates, priceCents: null }),
    });
    setSavingPrice(false);
    if (!res.ok) {
      toast.error("Couldn't reset price.");
      return;
    }
    const next = { ...overrides, [selection.carId]: { ...(overrides[selection.carId] ?? {}) } };
    for (const d of selDates) delete next[selection.carId][d];
    setOverrides(next);
    toast.success("Reset to base rate.");
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="headline text-[clamp(46px,6vw,72px)]">Calendar</h1>

      <div className="flex items-start gap-4">
        {/* ── Grid ─────────────────────────────────────────── */}
        <div className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-[24px] bg-white">
          <div className="overflow-auto" style={{ maxHeight: "calc(100vh - 178px)" }}>
            {/* Inner div sets the total width so horizontal scroll works */}
            <div style={{ minWidth: CAR_COL_W + dates.length * DAY_COL_W }}>

              {/* ── Date header (sticky top) ── */}
              <div
                className="sticky top-0 z-20 flex border-b border-line bg-white"
              >
                {/* Corner – nav arrows */}
                <div
                  className="sticky left-0 z-30 flex shrink-0 items-center justify-between border-r border-line bg-white px-2 py-2"
                  style={{ width: CAR_COL_W }}
                >
                  <button
                    type="button"
                    aria-label="Back 14 days"
                    onClick={() => setWindowStart((s) => addDays(s, -14))}
                    className="rounded-[8px] p-1.5 transition-colors hover:bg-board"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <span className="text-[12px] font-bold text-slate">
                    {new Date(`${windowStart}T12:00:00Z`).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                  </span>
                  <button
                    type="button"
                    aria-label="Forward 14 days"
                    onClick={() => setWindowStart((s) => addDays(s, 14))}
                    className="rounded-[8px] p-1.5 transition-colors hover:bg-board"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                {/* Date columns */}
                {dates.map((dk, i) => {
                  const { day, num, monthMark } = headers[i];
                  const isToday = dk === today;
                  return (
                    <div
                      key={dk}
                      className="relative flex shrink-0 flex-col items-center justify-end border-r border-line pb-1.5 pt-5 last:border-r-0"
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
                    </div>
                  );
                })}
              </div>

              {/* ── Car rows ── */}
              {cars.map((car) => {
                const selected = selection?.carId === car.id;
                return (
                  <CarRow
                    key={car.id}
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
          {selection && selectedCar ? (
            <>
              <div>
                <h2 className="text-[18px] font-extrabold leading-tight">{selectedCar.name}</h2>
                <p className="mt-0.5 text-[13px] text-slate">
                  {formatRange(zonedInstant(selection.from), zonedInstant(selection.to))}
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
                    Base rate:{" "}
                    <strong className="text-ink">{formatPrice(selectedCar.dailyRateCents)}/day</strong>
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="price-input" className="text-sm font-semibold">
                      Set custom price
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="price-input"
                        type="number"
                        min="1"
                        step="1"
                        placeholder={(selectedCar.dailyRateCents / 100).toFixed(0)}
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={savePrice} disabled={savingPrice || !priceInput}>
                        {savingPrice ? "…" : "Apply"}
                      </Button>
                    </div>
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
                      {selOccupants.map((o) => (
                        <div key={o.id} className="rounded-[12px] bg-board p-3 text-[13px]">
                          <p className="font-semibold">{o.label}</p>
                          <p className="mt-0.5 text-slate">
                            {formatRange(new Date(o.start), new Date(o.end))}
                          </p>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <p className="text-[13px] text-slate">
                        All {pluralize(selectedDays, "day")} are open.
                      </p>
                      <button
                        type="button"
                        onClick={() => setBlocking(true)}
                        className="flex items-center gap-3 rounded-[18px] bg-ink p-4 text-left text-white transition-colors hover:bg-graphite"
                      >
                        <CalendarX className="size-5 shrink-0" strokeWidth={1.75} />
                        <span>
                          <span className="block text-[15px] font-extrabold">Block these days</span>
                          <span className="text-[12px] opacity-75">Nobody can book them</span>
                        </span>
                      </button>
                    </>
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
                    selOccupants.map((o) => (
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
                          <p className="font-semibold">{o.label}</p>
                        </div>
                        <p className="mt-0.5 text-slate">
                          {formatRange(new Date(o.start), new Date(o.end))}
                        </p>
                        {o.kind !== "blocked" && (
                          <Link
                            href={
                              o.kind === "request"
                                ? "/host/trips?show=requests"
                                : "/host/trips?show=upcoming"
                            }
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
                Click a date on any car row to select it. Drag to extend the range. Then set
                prices, block days, or view trips in the panel.
              </p>
              <p className="rounded-[18px] bg-sky p-3.5 text-[13px] leading-[1.45] text-sky-ink">
                Tip: on mobile, tap the first day then tap the last day to select a range.
              </p>
            </>
          )}
        </aside>
      </div>

      {selection && blocking && selectedCar && (
        <BlockDateModal
          key={`${selection.carId}-${selection.from}-${selection.to}`}
          open={blocking}
          onOpenChange={setBlocking}
          vehicleId={selection.carId}
          carName={selectedCar.name}
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
  car: MultiCalendarCar;
  dates: string[];
  dayNames: Map<string, string>;
  today: string;
  occupancy: Map<string, Occupant>;
  prices: Record<string, number> | undefined;
  selFrom: string | null;
  selTo: string | null;
  onStart: (carId: string, key: string) => void;
  onDrag: (carId: string, key: string) => void;
}) {
  return (
    <div className="flex border-b border-line last:border-b-0">
      {/* Car label (sticky left) */}
      <div
        className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-line bg-white px-2.5 py-2"
        style={{ width: CAR_COL_W, minHeight: ROW_H }}
      >
        <Link href={`/host/vehicles/${car.id}`} className="shrink-0">
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
        <Link
          href={`/host/vehicles/${car.id}`}
          className="line-clamp-2 text-[12px] font-bold leading-tight hover:text-cobalt"
        >
          {car.name}
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
            onPointerDown={() => onStart(car.id, dk)}
            onPointerEnter={() => onDrag(car.id, dk)}
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
