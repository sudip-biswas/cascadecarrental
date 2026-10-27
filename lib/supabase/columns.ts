import type { Vehicle } from "./types";

/**
 * Vehicle columns anyone can read. Plate, VIN and exact address are hidden
 * by column grants, so `select("*")` on vehicles fails for users: list these
 * instead, and read the private ones with the admin client after an owner check.
 */
export const VEHICLE_PUBLIC =
  "id, host_id, make, model, trim, year, color, vehicle_type, fuel_type, transmission, seats, doors, mpg, range_miles, location_name, location_lat, location_lng, daily_rate_cents, weekly_discount_pct, monthly_discount_pct, three_day_discount_pct, two_week_discount_pct, three_week_discount_pct, last_minute_boost_pct, distance_included_mi, extra_mile_fee_cents, min_trip_days, max_trip_days, advance_notice_hours, instant_book, description, status, rating_avg, trip_count, created_at, updated_at";

export type PublicVehicle = Omit<Vehicle, "license_plate" | "vin" | "location_address">;
