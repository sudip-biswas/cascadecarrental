/** Listing limits shared by the wizard and POST /api/vehicles, so both reject the same things. */
export const LIMITS = {
  yearMin: 1990,
  yearMax: new Date().getFullYear() + 1,
  mpgMin: 1,
  mpgMax: 150,
  seatsMin: 1,
  seatsMax: 15,
  plateMax: 10,
  rateMinCents: 1000,
  rateMaxCents: 100000,
  discountMaxPct: 50,
  milesMax: 2000,
  extraMileMaxCents: 500,
  minTripMax: 30,
  maxTripMax: 365,
  noticeMaxHours: 168,
  photosToList: 3,
  photosMax: 20,
  photoMaxBytes: 10 * 1024 * 1024,
} as const;

export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
