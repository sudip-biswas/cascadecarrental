import { toDateKey } from "@/lib/utils";
import { addDays } from "@/components/host/days";

/** The last `count` Pacific dates, oldest first, ending today. */
export function lastDays(now: Date, count: number): string[] {
  const today = toDateKey(now);
  return Array.from({ length: count }, (_, i) => addDays(today, i - (count - 1)));
}

/** Nights a trip covers: every date from pick-up up to, not including, the return date. */
export function tripDateKeys(startsAt: string, endsAt: string): string[] {
  const keys: string[] = [];
  const end = toDateKey(endsAt);
  for (let key = toDateKey(startsAt); key < end; key = addDays(key, 1)) keys.push(key);
  return keys;
}

/** Every date a block touches, end date included (blocks end at 23:59 on their last day). */
export function blockDateKeys(from: string, to: string): string[] {
  const keys: string[] = [];
  const end = toDateKey(to);
  for (let key = toDateKey(from); key <= end; key = addDays(key, 1)) keys.push(key);
  return keys;
}

/** 0 = Sunday … 6 = Saturday for a date key. */
export function weekday(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
