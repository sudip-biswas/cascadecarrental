import { AGE_SLOPE, MARKET_RATES, TYPE_RATES } from "@/lib/market-rates";

/** How types compare to a sedan, for types the market data has no cars of. */
const BASE: Record<string, number> = {
  sedan:   5500,
  suv:     7500,
  truck:   8000,
  van:     9000,
  sports:  12000,
  luxury:  15000,
  electric: 9500,
};

/** Turo lists cars older than 2014 as 2014, so the market data does too. */
const OLDEST_MARKET_YEAR = 2014;

/** Turo files a Toyota "Scion iQ" under Scion, and a Silverado 1500 as a Silverado. */
function key(make: string, model: string): string {
  const m = model.trim().toLowerCase().replace(/\s+1500$/, "");
  return m.startsWith("scion ") ? `scion|${m.slice(6)}` : `${make.trim().toLowerCase()}|${m}`;
}

/** A price from `fromYear` moved to `toYear` along the age curve. */
const ageMove = (cents: number, fromYear: number, toYear: number) => cents * Math.exp(AGE_SLOPE * (fromYear - toYear));

/**
 * Returns a suggested daily rate in cents, rounded to the dollar: what the same
 * model and year earns in Seattle, else the same model at the nearest year, else
 * a typical car of its type and age.
 */
export function suggestDailyRate(vehicleType: string, year: number, make?: string, model?: string): number {
  const years = make && model ? MARKET_RATES[key(make, model)] : undefined;
  const asListed = Math.max(OLDEST_MARKET_YEAR, year);
  let cents: number;
  if (years?.[asListed]) {
    cents = years[asListed];
  } else if (years) {
    const nearest = Object.keys(years)
      .map(Number)
      .sort((a, b) => Math.abs(a - asListed) - Math.abs(b - asListed))[0];
    cents = ageMove(years[nearest], nearest, asListed);
  } else if (TYPE_RATES[vehicleType]) {
    cents = ageMove(TYPE_RATES[vehicleType], 2016, year);
  } else {
    cents = ageMove(TYPE_RATES.sedan * ((BASE[vehicleType] ?? BASE.sedan) / BASE.sedan), 2016, year);
  }
  return Math.max(100, Math.round(cents / 100) * 100);
}
