import { readDates, type DateKey } from "./dates";

export type SortKey = "price" | "rating" | "newest";

export interface SearchFilters {
  where: string | null;
  dates: { from: DateKey; until: DateKey } | null;
  types: string[];
  fuels: string[];
  minSeats: number | null;
  maxPrice: number | null;
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

export function parseSearchParams(raw: RawParams): SearchFilters {
  const sort = one(raw.sort);
  // Older links used a comma list of seat counts; the smallest one is the floor.
  const seats = list(raw.seats).map((s) => positiveInt(s)).filter((n): n is number => n !== null);
  return {
    where: one(raw.where)?.trim() || null,
    dates: readDates(one(raw.from), one(raw.until)),
    types: list(raw.type),
    fuels: list(raw.fuel),
    minSeats: seats.length ? Math.min(...seats) : null,
    maxPrice: positiveInt(one(raw.maxPrice)),
    instant: one(raw.instant) === "1",
    nearSea: one(raw.near) === "sea",
    weekDiscount: one(raw.discount) === "week",
    sort: sort === "rating" || sort === "newest" ? sort : "price",
  };
}

/** Filter keys (not where/when) that the "Clear filters" link drops. */
export const FILTER_KEYS = ["type", "fuel", "seats", "maxPrice", "instant", "near", "discount"];

export function hasFilters(filters: SearchFilters) {
  return (
    filters.types.length > 0 ||
    filters.fuels.length > 0 ||
    filters.minSeats !== null ||
    filters.maxPrice !== null ||
    filters.instant ||
    filters.nearSea ||
    filters.weekDiscount
  );
}
