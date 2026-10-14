import { LIMITS, VIN_PATTERN } from "@/lib/listing-limits";

export const VEHICLE_TYPES = ["sedan", "suv", "truck", "van", "sports", "luxury", "electric"] as const;
export const FUEL_TYPES = ["gasoline", "hybrid", "electric", "diesel"] as const;
export const TRANSMISSIONS = ["automatic", "manual"] as const;

export const TYPE_LABELS: Record<(typeof VEHICLE_TYPES)[number], string> = {
  sedan: "Sedan",
  suv: "SUV",
  truck: "Truck",
  van: "Van",
  sports: "Sports",
  luxury: "Luxury",
  electric: "Electric",
};

export const FUEL_LABELS: Record<(typeof FUEL_TYPES)[number], string> = {
  gasoline: "Gas",
  hybrid: "Hybrid",
  electric: "Electric",
  diesel: "Diesel",
};

export interface Photo {
  id: string;
  file: File;
  /** Object URL for the preview. */
  url: string;
}

export interface WizardData {
  // 1 Car
  vin: string;
  make: string;
  model: string;
  year: number;
  trim: string;
  color: string;
  licensePlate: string;
  vehicleType: (typeof VEHICLE_TYPES)[number];
  fuelType: (typeof FUEL_TYPES)[number];
  transmission: (typeof TRANSMISSIONS)[number];
  seats: number;
  mpg: string;
  description: string;
  // 2 Photos, in order; the first is the cover
  photos: Photo[];
  // 3 Price
  dailyRateCents: number;
  weeklyDiscountPct: number;
  monthlyDiscountPct: number;
  distanceIncludedMi: number;
  extraMileFeeCents: number;
  // 4 Rules
  locationName: string;
  locationAddress: string;
  minTripDays: number;
  maxTripDays: number;
  advanceNoticeHours: number;
  instantBook: boolean;
}

export const DEFAULT_DATA: WizardData = {
  vin: "",
  make: "",
  model: "",
  year: new Date().getFullYear(),
  trim: "",
  color: "",
  licensePlate: "",
  vehicleType: "sedan",
  fuelType: "gasoline",
  transmission: "automatic",
  seats: 5,
  mpg: "",
  description: "",
  photos: [],
  dailyRateCents: 5000,
  weeklyDiscountPct: 10,
  monthlyDiscountPct: 20,
  distanceIncludedMi: 200,
  extraMileFeeCents: 20,
  locationName: "",
  locationAddress: "",
  minTripDays: 1,
  maxTripDays: 30,
  advanceNoticeHours: 1,
  instantBook: false,
};

export const STEPS = ["Car", "Photos", "Price", "Rules", "Go live"] as const;
export type StepIndex = 0 | 1 | 2 | 3 | 4;

export type Errors = Partial<Record<keyof WizardData, string>>;

/** What's wrong with one step, keyed by field. Empty when the step is good to go. */
export function validateStep(step: StepIndex, d: WizardData): Errors {
  const e: Errors = {};
  if (step === 0) {
    if (d.vin && !VIN_PATTERN.test(d.vin)) e.vin = "A VIN is 17 letters and numbers.";
    if (!d.make.trim()) e.make = "Add the make.";
    if (!d.model.trim()) e.model = "Add the model.";
    if (d.year < LIMITS.yearMin || d.year > LIMITS.yearMax) {
      e.year = `Cars from ${LIMITS.yearMin} to ${LIMITS.yearMax} only.`;
    }
    if (!d.licensePlate.trim()) e.licensePlate = "Add the plate.";
    else if (d.licensePlate.trim().length > LIMITS.plateMax) e.licensePlate = "That plate looks too long.";
    if (!Number.isInteger(d.seats) || d.seats < LIMITS.seatsMin || d.seats > LIMITS.seatsMax) {
      e.seats = `Between ${LIMITS.seatsMin} and ${LIMITS.seatsMax} seats.`;
    }
    if (d.mpg.trim()) {
      const mpg = Number(d.mpg);
      if (!Number.isInteger(mpg) || mpg < LIMITS.mpgMin || mpg > LIMITS.mpgMax) {
        e.mpg = "MPG has to be a whole number from 1 to 150.";
      }
    }
  }
  if (step === 1 && d.photos.length === 0) e.photos = "Add at least one photo.";
  if (step === 2) {
    if (d.dailyRateCents < LIMITS.rateMinCents || d.dailyRateCents > LIMITS.rateMaxCents) {
      e.dailyRateCents = `Between $${LIMITS.rateMinCents / 100} and $${LIMITS.rateMaxCents / 100} a day.`;
    }
    if (d.weeklyDiscountPct > LIMITS.discountMaxPct) e.weeklyDiscountPct = "Up to 50% off.";
    if (d.monthlyDiscountPct > LIMITS.discountMaxPct) e.monthlyDiscountPct = "Up to 50% off.";
    if (d.distanceIncludedMi > LIMITS.milesMax) e.distanceIncludedMi = `Up to ${LIMITS.milesMax} miles.`;
    if (d.extraMileFeeCents > LIMITS.extraMileMaxCents) e.extraMileFeeCents = "Up to $5 a mile.";
  }
  if (step === 3) {
    if (!d.locationName.trim()) e.locationName = "Say where guests pick up.";
    if (d.maxTripDays < d.minTripDays) e.maxTripDays = "Longest trip can't be shorter than the shortest.";
  }
  return e;
}

/** The car's name as guests will see it. */
export function carName(d: Pick<WizardData, "make" | "model">) {
  return [d.make, d.model].filter((s) => s.trim()).join(" ") || "Your car";
}

/** Fields kept on this device between visits. Photos can't be, so they're left out. */
export type Draft = Omit<WizardData, "photos">;

const DRAFT_KEY = "cascade:listing-draft:v1";

export function loadDraft(): { data: Draft; step: StepIndex; reached: StepIndex } | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { data?: Partial<Draft>; step?: number; reached?: number };
    const clamp = (n: unknown): StepIndex => (Math.min(4, Math.max(0, Number(n) || 0)) as StepIndex);
    return {
      data: { ...stripPhotos(DEFAULT_DATA), ...saved.data },
      step: clamp(saved.step),
      reached: clamp(saved.reached),
    };
  } catch {
    return null;
  }
}

export function saveDraft(data: WizardData, step: StepIndex, reached: StepIndex) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ data: stripPhotos(data), step, reached }));
  } catch {
    // Private mode or storage full: the draft just won't survive a reload.
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}

function stripPhotos(data: WizardData): Draft {
  const { photos: _photos, ...rest } = data;
  void _photos;
  return rest;
}
