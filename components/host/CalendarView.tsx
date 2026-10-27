"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CalendarX, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatDate, formatDateTime, formatPrice, formatRange, pluralize, zonedInstant } from "@/lib/utils";
import { BlockDateModal } from "./BlockDateModal";
import { LegendItem } from "./bits";
import {
  addDays,
  dayOfMonth,
  daysBetween,
  occupantOn,
  OCCUPANT_FILL,
  weekdayIndex,
  type Occupant,
} from "./days";

export interface CalendarCar {
  id: string;
  name: string;
  cover: string | null;
  dailyRateCents: number;
  occupants: Occupant[];
}

type Selection = { from: string; to: string };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthKeys(month: string) {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => addDays(`${month}-01`, i));
}

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

/** Month view of one car: trips, requests and blocks, with drag-to-select for blocking days. */
export function HostCalendar({ cars, carId, today }: { cars: CalendarCar[]; carId: string; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const car = cars.find((c) => c.id === carId) ?? cars[0];

  const [month, setMonth] = useState(today.slice(0, 7));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [focus, setFocus] = useState<Occupant | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [unblocking, setUnblocking] = useState(false);

  // Stop drag-selecting when the pointer is released anywhere.
  useEffect(() => {
    const stop = () => setAnchor(null);
    window.addEventListener("pointerup", stop);
    return () => window.removeEventListener("pointerup", stop);
  }, []);

  const keys = useMemo(() => monthKeys(month), [month]);
  const lead = weekdayIndex(keys[0]);
  const trail = (7 - ((lead + keys.length) % 7)) % 7;

  const selectedDays = selection ? daysBetween(selection.from, selection.to) + 1 : 0;
  const selectionClash =
    selection &&
    Array.from({ length: selectedDays }, (_, i) => addDays(selection.from, i)).some((k) =>
      occupantOn(k, car.occupants)
    );

  function pickCar(id: string) {
    setSelection(null);
    setFocus(null);
    const next = new URLSearchParams(params);
    next.set("car", id);
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  function startAt(key: string) {
    const occupant = occupantOn(key, car.occupants);
    if (occupant) {
      setFocus(occupant);
      setSelection(null);
      return;
    }
    if (key < today) return;
    setFocus(null);
    // A second tap after a single day extends to a range, so phones can select without dragging.
    if (selection && selection.from === selection.to && key !== selection.from) {
      setSelection(key < selection.from ? { from: key, to: selection.from } : { from: selection.from, to: key });
      return;
    }
    setSelection({ from: key, to: key });
    setAnchor(key);
  }

  function dragTo(key: string) {
    if (!anchor || key < today) return;
    setSelection(key < anchor ? { from: key, to: anchor } : { from: anchor, to: key });
  }

  async function unblock(block: Occupant) {
    setUnblocking(true);
    const res = await fetch(`/api/vehicles/${car.id}/block?blockId=${block.id}`, { method: "DELETE" });
    const body: { error?: string } = await res.json().catch(() => ({}));
    setUnblocking(false);
    if (!res.ok) {
      toast.error(body.error ?? "Couldn't unblock those days.");
      return;
    }
    toast.success("Unblocked. Guests can book those days again.");
    setFocus(null);
    router.refresh();
  }

  const monthLabel = formatDate(`${month}-15T12:00:00Z`, { month: "long", day: undefined, year: "numeric" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="headline text-[clamp(46px,6vw,72px)]">Calendar</h1>
        <div className="flex flex-wrap items-center gap-2">
          {cars.length > 1 ? (
            <Select value={car.id} onValueChange={pickCar}>
              <SelectTrigger className="h-[46px] gap-2 rounded-[12px] bg-white pl-2.5 text-[15px] font-bold hover:bg-white/70" aria-label="Car">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {cars.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="flex h-[46px] items-center gap-2 rounded-[12px] bg-white px-3 text-[15px] font-bold">
              {car.cover && (
                <Image src={car.cover} alt="" width={30} height={24} className="h-6 w-[30px] rounded-[6px] object-cover" />
              )}
              {car.name}
            </span>
          )}
          <Button variant="outline" size="icon" className="size-[46px] rounded-[12px]" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft />
          </Button>
          <span className="min-w-[170px] px-1.5 text-center font-display text-[22px] font-extrabold sm:text-[24px]">{monthLabel}</span>
          <Button variant="outline" size="icon" className="size-[46px] rounded-[12px]" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-2 rounded-[30px] bg-white p-3 sm:p-[18px]">
          <div className="grid grid-cols-7 gap-1 text-center text-[13px] font-bold text-slate sm:gap-1.5">
            {WEEKDAYS.map((d) => (
              <span key={d}>
                <span className="sm:hidden">{d[0]}</span>
                <span className="hidden sm:inline">{d}</span>
              </span>
            ))}
          </div>
          <div className="figures grid touch-pan-y grid-cols-7 gap-1 select-none sm:gap-1.5">
            {Array.from({ length: lead }, (_, i) => (
              <span key={`lead-${i}`} />
            ))}
            {keys.map((key) => {
              const occupant = occupantOn(key, car.occupants);
              const past = key < today;
              const selected = selection && key >= selection.from && key <= selection.to;
              const startsHere = occupant && (key === keys[0] || occupantOn(addDays(key, -1), car.occupants)?.id !== occupant.id);
              return (
                <button
                  key={key}
                  type="button"
                  onPointerDown={() => startAt(key)}
                  onPointerEnter={() => dragTo(key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      startAt(key);
                    }
                  }}
                  aria-pressed={Boolean(selected)}
                  aria-label={`${formatDate(zonedInstant(key), { weekday: "long", year: undefined })}${occupant ? `, ${occupant.label}` : ""}`}
                  className={cn(
                    "flex h-16 flex-col justify-between overflow-hidden rounded-[12px] p-1.5 text-left sm:h-[104px] sm:rounded-[16px] sm:p-2.5",
                    occupant ? OCCUPANT_FILL[occupant.kind] : selected ? "bg-sky text-sky-ink" : "bg-board",
                    past && !occupant && "text-[#9ca0a8]",
                    focus && occupant?.id === focus.id && "ring-2 ring-cobalt ring-inset",
                    key === today && !occupant && !selected && "ring-2 ring-ink ring-inset"
                  )}
                >
                  <span className="text-sm font-extrabold sm:text-base">{dayOfMonth(key)}</span>
                  <span className="hidden truncate text-[12px] font-bold sm:block">
                    {occupant ? (startsHere ? occupant.label : "") : past ? "" : formatPrice(car.dailyRateCents)}
                  </span>
                </button>
              );
            })}
            {Array.from({ length: trail }, (_, i) => (
              <span key={`trail-${i}`} />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 px-1 pt-2 text-sm text-slate">
            <LegendItem swatch="bg-ink" label="Booked" />
            <LegendItem swatch="bg-butter" label="Request" />
            <LegendItem swatch="bg-[#c9ccd3]" label="Blocked by you" />
            <LegendItem swatch="bg-sky" label="Selected" />
          </div>
        </section>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 rounded-[30px] bg-white p-5 sm:p-[22px]">
          {focus ? (
            <FocusPanel occupant={focus} unblocking={unblocking} onUnblock={() => unblock(focus)} onClose={() => setFocus(null)} />
          ) : selection ? (
            <>
              <h2 className="text-[28px]">{formatRange(zonedInstant(selection.from), zonedInstant(selection.to))}</h2>
              <p className="text-[15px] text-slate">
                {pluralize(selectedDays, "day")} selected, {selectionClash ? "some already taken" : "all open"}
              </p>
              <button
                type="button"
                disabled={Boolean(selectionClash)}
                onClick={() => setBlocking(true)}
                className="flex items-center gap-3 rounded-[18px] bg-ink p-4 text-left text-white transition-colors hover:bg-graphite disabled:bg-line disabled:text-slate"
              >
                <CalendarX className="size-6 shrink-0" strokeWidth={1.75} />
                <span>
                  <span className="block text-[17px] font-extrabold">Block these days</span>
                  <span className="text-sm opacity-75">
                    {selectionClash ? "Pick days that are free" : "Nobody can book them"}
                  </span>
                </span>
              </button>
              <button type="button" onClick={() => setSelection(null)} className="self-start text-[15px] font-bold hover:text-cobalt">
                Clear selection
              </button>
            </>
          ) : (
            <>
              <h2 className="text-[28px]">{car.name}</h2>
              <p className="text-[15px] text-slate">Select days to block them, or tap a trip to see it.</p>
            </>
          )}
          <p className="rounded-[18px] bg-sky p-3.5 text-sm leading-[1.45] text-sky-ink">
            Tip: drag across days to select them. On a phone, tap the first day and then the last.
          </p>
        </aside>
      </div>

      {selection && blocking && (
        <BlockDateModal
          key={`${selection.from}-${selection.to}`}
          open={blocking}
          onOpenChange={setBlocking}
          cars={[{ id: car.id, name: car.name }]}
          from={selection.from}
          to={selection.to}
          onBlocked={() => {
            setSelection(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function FocusPanel({
  occupant,
  unblocking,
  onUnblock,
  onClose,
}: {
  occupant: Occupant;
  unblocking: boolean;
  onUnblock: () => void;
  onClose: () => void;
}) {
  const range = formatRange(occupant.start, occupant.end);
  if (occupant.kind === "blocked") {
    return (
      <>
        <h2 className="text-[28px]">{range}</h2>
        <p className="text-[15px] text-slate">Blocked by you{occupant.label !== "Blocked" ? `: ${occupant.label}` : ""}</p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={unblocking} onClick={onUnblock}>
            {unblocking ? "Unblocking…" : "Unblock these days"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </>
    );
  }
  return (
    <>
      <h2 className="text-[28px]">{occupant.label}</h2>
      <p className="text-[15px] text-slate">
        Pick-up {formatDateTime(occupant.start)}
        <br />
        Return {formatDateTime(occupant.end)}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href={`/host/trips/${occupant.id}`}>
            {occupant.kind === "request" ? "Answer request" : "Open trip"}
          </Link>
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    </>
  );
}
