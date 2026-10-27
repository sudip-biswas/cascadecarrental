import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json, Vehicle } from "@/lib/supabase/types";
import { tripDays } from "@/lib/pricing";
import { TIME_ZONE, pluralize } from "@/lib/utils";

/**
 * The rules a trip has to meet before it can be booked: the car's notice,
 * length limits, weekend minimum and buffer, and the host's pickup and return
 * hours. Safe in the browser too, so the booking box and checkout say the same.
 */

/** One weekday's handover window, Seattle time. `to` is the last time a guest can arrive. */
export interface DayHours {
  open: boolean;
  from: string;
  to: string;
}

export interface HostHours {
  alwaysAvailable: boolean;
  /** Seven days, Sunday first. */
  week: DayHours[];
}

export type CarRules = Pick<
  Vehicle,
  "advance_notice_hours" | "min_trip_days" | "max_trip_days" | "trip_buffer_hours" | "weekend_min_two_days"
>;

export type TripRules = CarRules & { hours: HostHours };

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const DEFAULT_DAY: DayHours = { open: true, from: "10:00", to: "22:00" };

/** What a host who never set hours gets: guests can come at any time. */
export const ALWAYS_AVAILABLE: HostHours = {
  alwaysAvailable: true,
  week: WEEKDAYS.map(() => ({ ...DEFAULT_DAY })),
};

/** Buffer choices, like Turo's: none, then 1 hour up to 3 days. */
export const BUFFER_OPTIONS = [0, 1, 2, 3, 4, 6, 8, 12, 24, 48, 72];

/** Every half hour of the day, "00:00" to "23:30". */
export const TIME_STEPS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2).toString().padStart(2, "0");
  return `${h}:${i % 2 === 0 ? "00" : "30"}`;
});

const TIME = /^\d{2}:\d{2}$/;
const HOUR_MS = 60 * 60 * 1000;

function readDay(value: unknown): DayHours {
  const day = (value ?? {}) as Partial<DayHours>;
  const from = typeof day.from === "string" && TIME.test(day.from) ? day.from : DEFAULT_DAY.from;
  const to = typeof day.to === "string" && TIME.test(day.to) ? day.to : DEFAULT_DAY.to;
  return { open: day.open !== false, from, to: to > from ? to : DEFAULT_DAY.to };
}

/** A host_hours row as stored, or none, into hours the rules can use. */
export function readHostHours(row: { always_available: boolean; week: Json } | null | undefined): HostHours {
  if (!row) return ALWAYS_AVAILABLE;
  const week = Array.isArray(row.week) ? row.week : [];
  return { alwaysAvailable: row.always_available, week: WEEKDAYS.map((_, i) => readDay(week[i])) };
}

type Client = Pick<SupabaseClient<Database>, "from">;

export async function loadHostHours(client: Client, hostId: string): Promise<HostHours> {
  const { data } = await client
    .from("host_hours")
    .select("always_available, week")
    .eq("host_id", hostId)
    .maybeSingle();
  return readHostHours(data);
}

/** A car's rules with its host's hours, or null when there's no such car. */
export async function loadTripRules(client: Client, vehicleId: string): Promise<TripRules | null> {
  const { data: car } = await client
    .from("vehicles")
    .select("host_id, advance_notice_hours, min_trip_days, max_trip_days, trip_buffer_hours, weekend_min_two_days")
    .eq("id", vehicleId)
    .maybeSingle();
  if (!car) return null;
  const { host_id, ...rules } = car;
  return { ...rules, hours: await loadHostHours(client, host_id) };
}

const partsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** The Seattle date and wall-clock time of an instant: { key: "2026-10-18", time: "10:00" }. */
export function seattleParts(instant: Date): { key: string; time: string } {
  const p = Object.fromEntries(partsFormat.formatToParts(instant).map((x) => [x.type, x.value]));
  return { key: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** 0 for Sunday. */
export function weekdayOf(key: string): number {
  return new Date(`${key}T12:00:00Z`).getUTCDay();
}

/** The window on a date, or null when any time works. */
export function hoursOn(hours: HostHours, key: string): DayHours | null {
  return hours.alwaysAvailable ? null : hours.week[weekdayOf(key)];
}

export function isClosedOn(hours: HostHours, key: string): boolean {
  return hoursOn(hours, key)?.open === false;
}

export function timeFits(hours: HostHours, key: string, time: string): boolean {
  const day = hoursOn(hours, key);
  return !day || (day.open && time >= day.from && time <= day.to);
}

/** The half-hour times a guest can pick on a date. */
export function timesOn(hours: HostHours, key: string | undefined): string[] {
  if (!key) return TIME_STEPS;
  return TIME_STEPS.filter((t) => timeFits(hours, key, t));
}

/** The time itself when it fits, else the nearest end of that day's window. */
export function snapTime(hours: HostHours, key: string, time: string): string {
  const day = hoursOn(hours, key);
  if (!day || !day.open || timeFits(hours, key, time)) return time;
  return time < day.from ? day.from : day.to;
}

/** "7 AM", "10:30 PM", "12 PM". */
export function formatClock(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${m.toString().padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

/** "7 AM – 11 PM" or "Closed". */
export function formatWindow(day: DayHours): string {
  return day.open ? `${formatClock(day.from)} – ${formatClock(day.to)}` : "Closed";
}

/** One line for guests about when they can meet the host, or null when any time works. */
export function hoursHint(hours: HostHours, from?: string, until?: string): string | null {
  if (hours.alwaysAvailable) return null;
  const open = hours.week.filter((d) => d.open);
  const same = open.every((d) => d.from === open[0]?.from && d.to === open[0]?.to);
  if (same && open.length > 0) {
    const closed = hours.week.flatMap((d, i) => (d.open ? [] : [`${WEEKDAYS[i]}s`]));
    return `Pickup and return between ${formatClock(open[0].from)} and ${formatClock(open[0].to)}${
      closed.length ? `, not on ${closed.join(" or ")}` : ""
    }.`;
  }
  if (!from) return "Pickup and return hours depend on the day.";
  const windowOn = (key: string) => {
    const day = hours.week[weekdayOf(key)];
    return day.open ? formatWindow(day) : "closed";
  };
  const pick = `Pickup ${windowOn(from)}`;
  return until ? `${pick}, return ${windowOn(until)}.` : `${pick}.`;
}

/** A trip's start is on a weekend when it falls on a Friday, Saturday or Sunday. */
function startsOnWeekend(key: string) {
  const day = weekdayOf(key);
  return day === 0 || day === 5 || day === 6;
}

function handoverProblem(hours: HostHours, instant: Date, what: "Pickup" | "Return"): string | null {
  const { key, time } = seattleParts(instant);
  const day = hoursOn(hours, key);
  if (!day || timeFits(hours, key, time)) return null;
  const plural = what === "Pickup" ? "pickups" : "returns";
  if (!day.open) return `No ${plural} on ${WEEKDAYS[weekdayOf(key)]}s. Pick another day.`;
  return `${what} between ${formatClock(day.from)} and ${formatClock(day.to)}.`;
}

/**
 * Why a trip from start to end breaks the rules, or null when it doesn't.
 * Booked dates aren't checked here: see hasConflict, which adds the buffer.
 */
export function tripRuleProblem(rules: TripRules, start: Date, end: Date, now = Date.now()): string | null {
  if (end <= start) return "The return date has to be after pick-up.";
  if (start.getTime() - now < rules.advance_notice_hours * HOUR_MS) {
    return rules.advance_notice_hours > 0
      ? `The host needs ${pluralize(rules.advance_notice_hours, "hour")} notice. Pick a later time.`
      : "Pick-up has to be in the future.";
  }
  const days = tripDays(start, end);
  if (days < rules.min_trip_days) return `This car needs at least ${pluralize(rules.min_trip_days, "day")}.`;
  if (rules.max_trip_days && days > rules.max_trip_days) {
    return `This car can be booked for up to ${pluralize(rules.max_trip_days, "day")}.`;
  }
  if (rules.weekend_min_two_days && days < 2 && startsOnWeekend(seattleParts(start).key)) {
    return "Weekend trips need at least 2 days.";
  }
  return handoverProblem(rules.hours, start, "Pickup") ?? handoverProblem(rules.hours, end, "Return");
}

/**
 * Why new dates for a booked trip break the rules, or null. Only the ends that
 * move have to meet the host's hours, and notice and length are checked by the
 * caller, since a trip already under way can still move its return.
 */
export function changeRuleProblem(
  rules: Pick<TripRules, "weekend_min_two_days" | "hours">,
  start: Date,
  end: Date,
  moved: { start: boolean; end: boolean }
): string | null {
  if (moved.start && rules.weekend_min_two_days && tripDays(start, end) < 2 && startsOnWeekend(seattleParts(start).key)) {
    return "Weekend trips need at least 2 days.";
  }
  return (
    (moved.start ? handoverProblem(rules.hours, start, "Pickup") : null) ??
    (moved.end ? handoverProblem(rules.hours, end, "Return") : null)
  );
}

/** A booked range widened by the car's buffer on both sides. */
export function withBuffer<R extends { from: string; to: string }>(range: R, bufferHours: number): R {
  if (!bufferHours) return range;
  const ms = bufferHours * HOUR_MS;
  return {
    ...range,
    from: new Date(new Date(range.from).getTime() - ms).toISOString(),
    to: new Date(new Date(range.to).getTime() + ms).toISOString(),
  };
}

/** True when [start, end) touches any of the ranges. */
export function overlapsRanges(ranges: { from: string; to: string }[], start: Date, end: Date): boolean {
  return ranges.some((r) => new Date(r.from) < end && new Date(r.to) > start);
}

export function formatBuffer(hours: number): string {
  if (hours === 0) return "None";
  if (hours >= 24 && hours % 24 === 0) return pluralize(hours / 24, "day");
  return pluralize(hours, "hour");
}
