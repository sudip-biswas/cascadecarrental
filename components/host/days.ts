import { zonedInstant } from "@/lib/utils";

/** Calendar maths on Pacific date keys ("2026-10-18"), free of the viewer's time zone. */

export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromKey: string, toKey: string): number {
  return Math.round(
    (Date.parse(`${toKey}T12:00:00Z`) - Date.parse(`${fromKey}T12:00:00Z`)) / 86_400_000
  );
}

/** The instants a whole Pacific day covers: [midnight, next midnight). */
export function dayBounds(dateKey: string): [Date, Date] {
  return [zonedInstant(dateKey, "00:00"), zonedInstant(addDays(dateKey, 1), "00:00")];
}

export function overlapsDay(dateKey: string, start: string | Date, end: string | Date): boolean {
  const [dayStart, dayEnd] = dayBounds(dateKey);
  return new Date(start) < dayEnd && new Date(end) > dayStart;
}

/** Day of week for a date key, Monday = 0. */
export function weekdayIndex(dateKey: string): number {
  return (new Date(`${dateKey}T12:00:00Z`).getUTCDay() + 6) % 7;
}

export function dayOfMonth(dateKey: string): number {
  return Number(dateKey.slice(8, 10));
}

export interface Occupant {
  id: string;
  kind: "booked" | "request" | "blocked";
  label: string;
  start: string;
  end: string;
}

/** What fills a day, if anything. Trips win over blocks. */
export function occupantOn(dateKey: string, occupants: Occupant[]): Occupant | undefined {
  const hits = occupants.filter((o) => overlapsDay(dateKey, o.start, o.end));
  return hits.find((o) => o.kind !== "blocked") ?? hits[0];
}

export const OCCUPANT_FILL: Record<Occupant["kind"], string> = {
  booked: "bg-ink text-white",
  request: "bg-butter text-butter-ink",
  blocked: "bg-[#c9ccd3] text-ink",
};
