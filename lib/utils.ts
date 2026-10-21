export { cn } from "cn";

/** Cascade operates around Seattle, so every date is shown and picked in Pacific time. */
export const TIME_ZONE = "America/Los_Angeles";

/** Pick-up and return time for trips booked by date. */
export const HANDOVER_TIME = "10:00";

// Building an Intl formatter is slow, and calendars format thousands of cells, so reuse them.
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
});
const dateKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
const offsetFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  timeZoneName: "longOffset",
});
const dateFormats = new Map<string, Intl.DateTimeFormat>();

export function formatCurrency(cents: number): string {
  return usd.format(cents / 100);
}

/** Whole dollars when there are no cents, e.g. "$50" or "$49.50". */
export function formatPrice(cents: number): string {
  return (cents % 100 === 0 ? usdWhole : usd).format(cents / 100);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  // Keep undefined in the key: { year: undefined } means "no year", not the default.
  const key = JSON.stringify(options ?? {}, (_, v) => (v === undefined ? null : v));
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: TIME_ZONE,
      ...options,
    });
    dateFormats.set(key, format);
  }
  return format.format(new Date(date));
}

export function formatDateShort(date: string | Date): string {
  return formatDate(date, { year: undefined });
}

/** "Sat Oct 18" */
export function formatDay(date: string | Date): string {
  return `${formatDate(date, { weekday: "short", month: undefined, day: undefined, year: undefined })} ${formatDateShort(date)}`;
}

/** "10:00" */
export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(date));
}

export function formatDateTime(date: string | Date): string {
  return `${formatDay(date)} · ${formatTime(date)}`;
}

/** "Oct 18 – 21" or "Oct 30 – Nov 2" */
export function formatRange(start: string | Date, end: string | Date): string {
  const a = formatDateShort(start);
  const sameMonth =
    formatDate(start, { month: "short", day: undefined, year: undefined }) ===
    formatDate(end, { month: "short", day: undefined, year: undefined });
  const b = sameMonth ? formatDate(end, { month: undefined, day: "numeric", year: undefined }) : formatDateShort(end);
  return `${a} – ${b}`;
}

/** The calendar date ("2026-10-18") of an instant, in Pacific time. */
export function toDateKey(date: string | Date): string {
  return dateKeyFormat.format(new Date(date));
}

/** The instant a Pacific wall-clock time happens on a given date ("2026-10-18"). */
export function zonedInstant(dateKey: string, time = HANDOVER_TIME): Date {
  const probe = new Date(`${dateKey}T${time}:00Z`);
  const offset =
    offsetFormat
      .formatToParts(probe)
      .find((p) => p.type === "timeZoneName")
      ?.value.replace("GMT", "") || "+00:00";
  return new Date(`${dateKey}T${time}:00${offset}`);
}

export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return `${count} ${singular}`;
  return `${count} ${plural ?? singular + "s"}`;
}

/** "In 5 days", "Tomorrow", "Today" */
export function relativeDays(date: string | Date, now = new Date()): string {
  const days = Math.round(
    (zonedInstant(toDateKey(date)).getTime() - zonedInstant(toDateKey(now)).getTime()) / 86_400_000
  );
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

/** Only allow same-site paths, so a crafted link can't send people elsewhere after login. */
export function safeRedirect(path: string | null | undefined, fallback = "/"): string {
  if (!path || !path.startsWith("/")) return fallback;
  // Resolve it the way a browser would ("/\t/evil.com" becomes evil.com) and
  // keep it only if it stays on this site.
  const base = "http://cascade.invalid";
  try {
    const url = new URL(path, base);
    return url.origin === base ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
