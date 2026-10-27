/** Calendar toolbar filters: what they hold, how they live in the URL, and how they narrow the cars. */

export type CalendarSort = "added" | "name" | "year" | "price-low" | "price-high";

export const SORTS: { value: CalendarSort; label: string }[] = [
  { value: "added", label: "Order added" },
  { value: "name", label: "Name, A to Z" },
  { value: "year", label: "Year, newest" },
  { value: "price-low", label: "Price, low to high" },
  { value: "price-high", label: "Price, high to low" },
];

export type ListingStatus = "listed" | "unlisted" | "suspended";

export const STATUS_LABEL: Record<ListingStatus, string> = {
  listed: "Listed",
  unlisted: "Unlisted",
  suspended: "Suspended",
};

/** Empty lists mean "no filter", so a fresh calendar shows every car. */
export interface CalendarFilters {
  q: string;
  sort: CalendarSort;
  status: string[];
  cars: string[];
  cities: string[];
}

export const NO_FILTERS: CalendarFilters = { q: "", sort: "added", status: [], cars: [], cities: [] };

/** The fields a car needs for searching, sorting and filtering. */
export interface FilterableCar {
  id: string;
  name: string;
  trim: string | null;
  year: number;
  plate: string;
  status: ListingStatus;
  place: string;
  city: string;
  dailyRateCents: number;
}

const SORT_VALUES = new Set(SORTS.map((s) => s.value));

export function readFilters(params: URLSearchParams): CalendarFilters {
  const sort = params.get("sort") as CalendarSort | null;
  return {
    q: params.get("q") ?? "",
    sort: sort && SORT_VALUES.has(sort) ? sort : "added",
    status: params.getAll("status"),
    cars: params.getAll("car"),
    cities: params.getAll("city"),
  };
}

/** Writes the filters onto a copy of params, leaving anything else in the URL alone. */
export function writeFilters(params: URLSearchParams, f: CalendarFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of ["q", "sort", "status", "car", "city"]) next.delete(key);
  if (f.q.trim()) next.set("q", f.q.trim());
  if (f.sort !== "added") next.set("sort", f.sort);
  for (const s of f.status) next.append("status", s);
  for (const c of f.cars) next.append("car", c);
  for (const c of f.cities) next.append("city", c);
  return next;
}

/** How many filters narrow the list, not counting sort. */
export function activeCount(f: CalendarFilters): number {
  return (f.q.trim() ? 1 : 0) + (f.status.length ? 1 : 0) + (f.cars.length ? 1 : 0) + (f.cities.length ? 1 : 0);
}

const STATE = /^[A-Z]{2}(\s+\d{5}(-\d{4})?)?$/;
const COUNTRY = /^(USA?|United States( of America)?)$/i;

/** The city out of "101 Pine St, Seattle, WA 98101, USA"; falls back to the pickup spot's name. */
export function cityOf(address: string | null, placeName: string): string {
  const parts = (address ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length && COUNTRY.test(parts[parts.length - 1])) parts.pop();
  if (parts.length >= 2 && STATE.test(parts[parts.length - 1])) return parts[parts.length - 2];
  return placeName;
}

const squash = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "");

function matches(car: FilterableCar, q: string): boolean {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [car.name, car.trim ?? "", String(car.year), car.plate, car.place, car.city]
    .join(" ")
    .toLowerCase();
  const plate = squash(car.plate);
  return words.every((w) => hay.includes(w) || plate.includes(squash(w)));
}

/** The cars to show, in order. Keeps the incoming order for "Order added" and for ties. */
export function applyFilters<C extends FilterableCar>(cars: C[], f: CalendarFilters): C[] {
  const status = new Set(f.status);
  const ids = new Set(f.cars);
  const cities = new Set(f.cities);
  const out = cars.filter(
    (c) =>
      (!status.size || status.has(c.status)) &&
      (!ids.size || ids.has(c.id)) &&
      (!cities.size || cities.has(c.city)) &&
      matches(c, f.q)
  );
  const by: Record<CalendarSort, ((a: C, b: C) => number) | null> = {
    added: null,
    name: (a, b) => a.name.localeCompare(b.name) || b.year - a.year,
    year: (a, b) => b.year - a.year,
    "price-low": (a, b) => a.dailyRateCents - b.dailyRateCents,
    "price-high": (a, b) => b.dailyRateCents - a.dailyRateCents,
  };
  const compare = by[f.sort];
  return compare ? [...out].sort(compare) : out;
}
