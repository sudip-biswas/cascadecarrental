import {
  AIRPORT,
  YOUNG_DRIVER_AGE,
  ageOn,
  deliveryQuote,
  type DeliverySettings,
} from "@/lib/pricing";

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

/** Where the guest gets the car. Pick-up at the host's spot is free. */
export type DeliveryChoice =
  | { mode: "pickup" }
  | { mode: "address"; address: string; lat: number; lng: number }
  | { mode: "airport" };

export type DeliveryResult =
  | { ok: true; cents: number; address: string | null; lat: number | null; lng: number | null }
  | { ok: false; reason: string };

/** The car can come to the guest: to an address, the airport, or both. */
export function offersDelivery(car: Pick<DeliverySettings, "delivery_enabled" | "airport_delivery_fee_cents">) {
  return car.delivery_enabled || car.airport_delivery_fee_cents != null;
}

/** What the guest's choice costs, priced from the car's own settings. */
export function quoteDelivery(car: DeliverySettings, choice: DeliveryChoice): DeliveryResult {
  if (choice.mode === "pickup") return { ok: true, cents: 0, address: null, lat: null, lng: null };
  if (choice.mode === "airport") {
    const quote = deliveryQuote(car, { ...AIRPORT, airport: true });
    return quote.ok ? { ok: true, cents: quote.cents, address: AIRPORT.name, lat: AIRPORT.lat, lng: AIRPORT.lng } : quote;
  }
  const quote = deliveryQuote(car, choice);
  return quote.ok ? { ok: true, cents: quote.cents, address: choice.address, lat: choice.lat, lng: choice.lng } : quote;
}
