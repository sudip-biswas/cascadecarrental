import { readDates, readMonths, type DateKey } from "./dates";

export type SortKey = "price" | "price_high" | "rating" | "newest" | "distance";

/** Miles a day the car must include, or a car that offers unlimited miles. */
export type MilesFilter = 100 | 200 | 300 | "unlimited";

export interface SearchFilters {
  where: string | null;
  /** Lat/lng set when the user picked from the autocomplete dropdown. */
  lat: number | null;
  lng: number | null;
  dates: { from: DateKey; until: DateKey } | null;
  /** A monthly search: how many 30-day months from the start date. Dates hold the whole stretch. */
  months: number | null;
  types: string[];
  fuels: string[];
  minSeats: number | null;
  /** Daily price range, in dollars. */
  minPrice: number | null;
  maxPrice: number | null;
  makes: string[];
  /** "Make:Model" pairs, e.g. "Toyota:RAV4". */
  models: string[];
  minYear: number | null;
  maxYear: number | null;
  minMpg: number | null;
  transmission: "automatic" | "manual" | null;
  /** Slugs from FEATURES. A car needs every one. */
  features: string[];
  miles: MilesFilter | null;
  delivery: boolean;
  instant: boolean;
  nearSea: boolean;
  weekDiscount: boolean;
  sort: SortKey;
}

type RawParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: string | string[] | undefined) {
  return one(value)?.split(",").map((v) => v.trim()).filter(Boolean) ?? [];
}

function positiveInt(value: string | undefined) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function readMiles(value: string | undefined): MilesFilter | null {
  if (value === "unlimited") return value;
  const n = positiveInt(value);
  return n === 100 || n === 200 || n === 300 ? n : null;
}

export function parseSearchParams(raw: RawParams): SearchFilters {
  const sort = one(raw.sort);
  // Older links used a comma list of seat counts; the smallest one is the floor.
  const seats = list(raw.seats).map((s) => positiveInt(s)).filter((n): n is number => n !== null);
  const lat = parseFloat(one(raw.lat) ?? "");
  const lng = parseFloat(one(raw.lng) ?? "");
  const hasPlace = Number.isFinite(lat) && Number.isFinite(lng);
  const transmission = one(raw.transmission);
  const monthly = readMonths(one(raw.from), one(raw.months));
  return {
    where: one(raw.where)?.trim() || null,
    lat: hasPlace ? lat : null,
    lng: hasPlace ? lng : null,
    dates: monthly?.dates ?? readDates(one(raw.from), one(raw.until)),
    months: monthly?.months ?? null,
    types: list(raw.type),
    fuels: list(raw.fuel),
    minSeats: seats.length ? Math.min(...seats) : null,
    minPrice: positiveInt(one(raw.minPrice)),
    maxPrice: positiveInt(one(raw.maxPrice)),
    makes: list(raw.make),
    models: list(raw.model).filter((m) => m.includes(":")),
    minYear: positiveInt(one(raw.minYear)),
    maxYear: positiveInt(one(raw.maxYear)),
    minMpg: positiveInt(one(raw.mpg)),
    transmission: transmission === "automatic" || transmission === "manual" ? transmission : null,
    features: list(raw.features),
    miles: readMiles(one(raw.miles)),
    delivery: one(raw.deliver) === "1",
    instant: one(raw.instant) === "1",
    nearSea: one(raw.near) === "sea",
    weekDiscount: one(raw.discount) === "week",
    // Distance needs a picked place to measure from.
    sort:
      sort === "rating" || sort === "newest" || sort === "price_high" || (sort === "distance" && hasPlace)
        ? sort
        : "price",
  };
}

/** Filter keys (not where/when) that the "Clear filters" link drops. */
export const FILTER_KEYS = [
  "type",
  "fuel",
  "seats",
  "minPrice",
  "maxPrice",
  "make",
  "model",
  "minYear",
  "maxYear",
  "mpg",
  "transmission",
  "features",
  "miles",
  "deliver",
  "instant",
  "near",
  "discount",
];

/** How many filters are on, counting each group once. */
export function filterCount(filters: SearchFilters) {
  return [
    filters.types.length > 0,
    filters.fuels.length > 0,
    filters.minSeats !== null,
    filters.minPrice !== null || filters.maxPrice !== null,
    filters.makes.length > 0 || filters.models.length > 0,
    filters.minYear !== null || filters.maxYear !== null,
    filters.minMpg !== null,
    filters.transmission !== null,
    filters.features.length > 0,
    filters.miles !== null,
    filters.delivery,
    filters.instant,
    filters.nearSea,
    filters.weekDiscount,
  ].filter(Boolean).length;
}

export function hasFilters(filters: SearchFilters) {
  return filterCount(filters) > 0;
}
