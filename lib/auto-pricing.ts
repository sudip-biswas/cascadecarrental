import { addDays, weekdayIndex } from "@/components/host/days";

/**
 * Automatic pricing: each rule moves the car's daily rate by a percent, the
 * moves multiply, and the result stays inside the host's floor and ceiling.
 *
 * The weekday, season and summer holiday numbers are fitted to 2,299 Seattle
 * airport trips on Turo from March to October 2026: each car's level and the day
 * effects fitted together on log price, checked on cars left out of the fit.
 * There was no winter data, so November to February sit at the level of March
 * and October. Winter holidays and how busy nearby cars are still use first
 * guesses: the trips didn't cover them, or couldn't tell them apart from the
 * season.
 */

/** How far ahead automatic prices are written. */
export const AUTO_HORIZON_DAYS = 120;

/** With no floor or ceiling set, prices stay between these shares of the daily rate: wide enough for every fitted day. */
export const DEFAULT_FLOOR = 0.6;
export const DEFAULT_CEILING = 1.9;

/** All the rules together never move a day further than this, before the floor and ceiling. */
const MIN_PCT = -40;
const MAX_PCT = 100;

/** Monday first. Fitted, leaning toward no change where few short trips tell the days apart: Friday and Saturday cost most, Monday and Wednesday least. */
const WEEKDAY_PCT = [-11, -6, -12, -2, 15, 20, 1];
const WEEKDAY_NAME = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * January first. Fitted: prices jump in June, stay up through July, ease in August
 * and are back down by October. June and July 2026 had World Cup matches in
 * Seattle, so they may run high for other years.
 */
const MONTH_PCT = [-12, -12, -17, -15, -13, 46, 45, 29, 6, -7, -12, -12];
const SEASON_NAME = ["Winter", "Winter", "Early spring", "Spring", "Late spring", "Summer", "Summer", "Summer", "Early fall", "Fall", "Late fall", "Winter"];

/** Demand only counts once there are this many cars nearby; below that one booking swings it. */
export const MIN_NEARBY_CARS = 5;
/** Cars this close count as the same market. */
export const NEARBY_MILES = 25;

export interface PricingEvent {
  name: string;
  starts_on: string;
  ends_on: string;
  pct: number;
}

export interface DayContext {
  /** Pacific date key of today. */
  today: string;
  events: PricingEvent[];
  /** Share of nearby cars booked on the day, or null when too few cars to tell. */
  bookedShare: number | null;
}

export interface Factor {
  label: string;
  pct: number;
}

export interface AutoPrice {
  cents: number;
  /** The rules' total move, after the overall cap. */
  pct: number;
  factors: Factor[];
  /** Set when the floor or ceiling decided the price. */
  limit: "floor" | "ceiling" | null;
}

export interface AutoPricedCar {
  daily_rate_cents: number;
  auto_price_min_cents: number | null;
  auto_price_max_cents: number | null;
}

/** The floor and ceiling a car's automatic prices stay between, in cents. */
export function priceLimits(car: AutoPricedCar): { min: number; max: number } {
  const min = car.auto_price_min_cents ?? roundDollars(car.daily_rate_cents * DEFAULT_FLOOR);
  const max = car.auto_price_max_cents ?? roundDollars(car.daily_rate_cents * DEFAULT_CEILING);
  return { min, max: Math.max(min, max) };
}

/** What automatic pricing charges for one day, and why. */
export function autoPriceFor(car: AutoPricedCar, dateKey: string, ctx: DayContext): AutoPrice {
  const factors: Factor[] = [];
  const add = (label: string, pct: number) => {
    if (pct) factors.push({ label, pct });
  };

  const weekday = weekdayIndex(dateKey);
  add(WEEKDAY_NAME[weekday], WEEKDAY_PCT[weekday]);

  const month = Number(dateKey.slice(5, 7)) - 1;
  add(SEASON_NAME[month], MONTH_PCT[month]);

  // A holiday and an event on the same day don't stack: the bigger one counts.
  const occasions = [...holidaysOn(dateKey), ...ctx.events.filter((e) => e.starts_on <= dateKey && dateKey <= e.ends_on)];
  const biggest = occasions.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];
  if (biggest) add(biggest.name, biggest.pct);

  // Only demand above the season moves the price: Turo's prices don't drop for
  // quiet days or late bookings, so neither do these.
  const share = ctx.bookedShare;
  if (share !== null && share >= 0.8) add("Nearby cars almost all booked", 15);
  else if (share !== null && share >= 0.6) add("Nearby cars filling up", 8);

  const move = clamp(
    factors.reduce((m, f) => m * (1 + f.pct / 100), 1),
    1 + MIN_PCT / 100,
    1 + MAX_PCT / 100
  );
  const pct = Math.round((move - 1) * 100);
  const { min, max } = priceLimits(car);
  const raw = roundDollars(car.daily_rate_cents * move);
  const cents = clamp(raw, min, max);
  return { cents, pct, factors, limit: cents > raw ? "floor" : cents < raw ? "ceiling" : null };
}

/** Holidays that move rental demand, with the days around them that move with them. */
export function holidaysOn(dateKey: string): PricingEvent[] {
  const year = Number(dateKey.slice(0, 4));
  // Late December belongs to the coming New Year as well as this Christmas.
  return [...holidays(year), ...holidays(year + 1)].filter((h) => h.starts_on <= dateKey && dateKey <= h.ends_on);
}

const holidayCache = new Map<number, PricingEvent[]>();

function holidays(year: number): PricingEvent[] {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const key = (month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;
  const around = (name: string, day: string, before: number, after: number, pct: number): PricingEvent => ({
    name,
    starts_on: addDays(day, -before),
    ends_on: addDays(day, after),
    pct,
  });
  const list = [
    around("New Year", key(1, 1), 2, 0, 15),
    around("MLK Day weekend", nthWeekday(year, 1, 0, 3), 2, 0, 5),
    around("Presidents' Day weekend", nthWeekday(year, 2, 0, 3), 2, 0, 8),
    around("Memorial Day weekend", lastWeekday(year, 5, 0), 3, 0, 33),
    around("Fourth of July", key(7, 4), 2, 1, 4),
    around("Labor Day weekend", nthWeekday(year, 9, 0, 1), 3, 0, 25),
    around("Thanksgiving", nthWeekday(year, 11, 3, 4), 1, 3, 15),
    { name: "Christmas", starts_on: key(12, 20), ends_on: key(12, 29), pct: 12 },
  ];
  holidayCache.set(year, list);
  return list;
}

/** The nth of a weekday in a month (Monday = 0), as a date key. */
function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const first = `${year}-${pad(month)}-01`;
  return addDays(first, ((weekday - weekdayIndex(first) + 7) % 7) + (n - 1) * 7);
}

function lastWeekday(year: number, month: number, weekday: number): string {
  const last = addDays(month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`, -1);
  return addDays(last, -((weekdayIndex(last) - weekday + 7) % 7));
}

const pad = (n: number) => String(n).padStart(2, "0");

function roundDollars(cents: number): number {
  return Math.max(100, Math.round(cents / 100) * 100);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
