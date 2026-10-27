import { YOUNG_DRIVER_AGE, ageOn } from "@/lib/pricing";

// Checkout rules the page and /api/checkout both run, so the guest sees the
// same answer and price the server charges.

export interface DriverRules {
  min_age: number;
  young_driver_fee_cents: number;
}

export type DriverCheck =
  | { ok: true; age: number | null; youngDriverDailyCents: number }
  | { ok: false; reason: "needs_dob" | "too_young"; message: string };

/** Whole years old on the pick-up day ("2026-10-18", Pacific). */
export function ageAtPickup(dateOfBirth: string, from: string): number {
  return ageOn(dateOfBirth, new Date(`${from}T12:00:00Z`));
}

/** True when this car's rules need to know the driver's age. */
export function needsAge(car: DriverRules): boolean {
  return car.min_age > 18 || car.young_driver_fee_cents > 0;
}

/** Whether this driver can take the car, and the young driver fee per day if any. */
export function driverCheck(car: DriverRules, dateOfBirth: string | null, from: string): DriverCheck {
  if (!dateOfBirth) {
    return needsAge(car)
      ? { ok: false, reason: "needs_dob", message: "Add your date of birth to book this car." }
      : { ok: true, age: null, youngDriverDailyCents: 0 };
  }
  const age = ageAtPickup(dateOfBirth, from);
  if (age < car.min_age) {
    return {
      ok: false,
      reason: "too_young",
      message: `Drivers have to be ${car.min_age} or older for this car. You'll be ${age} at pick-up.`,
    };
  }
  return { ok: true, age, youngDriverDailyCents: age < YOUNG_DRIVER_AGE ? car.young_driver_fee_cents : 0 };
}
