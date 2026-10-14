import { toDateKey, zonedInstant } from "@/lib/utils";
import { tripDays } from "@/lib/pricing";

/** A Pacific calendar date, "2026-10-18". */
export type DateKey = string;

const KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string | null | undefined): value is DateKey {
  return !!value && KEY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Day pickers work in the browser's local time; these map their dates to and from keys. */
export function keyToLocalDate(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function localDateToKey(date: Date): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(): DateKey {
  return toDateKey(new Date());
}

/** Days billed for a from/until pair, the same way checkout counts them. */
export function daysBetween(from: DateKey, until: DateKey): number {
  return tripDays(zonedInstant(from), zonedInstant(until));
}

/** A valid from/until pair from the URL, or nothing. */
export function readDates(
  from: string | null | undefined,
  until: string | null | undefined
): { from: DateKey; until: DateKey } | null {
  if (!isDateKey(from) || !isDateKey(until) || until <= from) return null;
  return { from, until };
}

export interface Range {
  from: string;
  to: string;
}

/**
 * Nights (a night is a date's 10:00 to the next day's 10:00) that overlap
 * a booked or blocked range. A trip from A to B uses nights A..B-1.
 */
export function bookedNights(ranges: Range[]): Set<DateKey> {
  const nights = new Set<DateKey>();
  for (const range of ranges) {
    const start = new Date(range.from).getTime();
    const end = new Date(range.to).getTime();
    let key = addDays(toDateKey(range.from), -1);
    const last = toDateKey(range.to);
    while (key <= last) {
      const nightStart = zonedInstant(key).getTime();
      const nightEnd = zonedInstant(addDays(key, 1)).getTime();
      if (nightStart < end && nightEnd > start) nights.add(key);
      key = addDays(key, 1);
    }
  }
  return nights;
}

export function overlapsBooked(from: DateKey, until: DateKey, nights: Set<DateKey>): boolean {
  for (let key = from; key < until; key = addDays(key, 1)) {
    if (nights.has(key)) return true;
  }
  return false;
}
