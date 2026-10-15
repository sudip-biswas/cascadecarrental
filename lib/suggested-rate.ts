/** Base daily rates in cents by vehicle type. */
const BASE: Record<string, number> = {
  sedan:   5500,
  suv:     7500,
  truck:   8000,
  van:     9000,
  sports:  12000,
  luxury:  15000,
  electric: 9500,
};

/** Year-based adjustment in cents (+/- per bracket). */
function yearAdj(year: number): number {
  if (year >= 2023) return 1500;
  if (year >= 2020) return 1000;
  if (year >= 2018) return  500;
  if (year >= 2015) return    0;
  if (year >= 2012) return -500;
  return -1000;
}

/**
 * Returns a suggested daily rate in cents, rounded to the nearest $5,
 * based on vehicle type and model year.
 */
export function suggestDailyRate(vehicleType: string, year: number): number {
  const base = BASE[vehicleType] ?? 5500;
  const raw  = base + yearAdj(year);
  return Math.round(raw / 500) * 500; // snap to nearest $5
}
