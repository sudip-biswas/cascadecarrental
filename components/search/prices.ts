import { createAdminClient } from "@/lib/supabase/admin";
import { toDateKey } from "@/lib/utils";

/**
 * Each car with what a day costs today: its dynamic or custom price, else its
 * daily rate. Guests can't read day prices, so this uses the service role.
 */
export async function withTodayPrices<T extends { id: string; daily_rate_cents: number }>(
  cars: T[]
): Promise<(T & { price_today_cents?: number })[]> {
  if (!cars.length) return [];
  const { data } = await createAdminClient()
    .from("vehicle_daily_prices")
    .select("vehicle_id, price_cents")
    .in("vehicle_id", cars.map((c) => c.id))
    .eq("date", toDateKey(new Date()));
  const today = new Map((data ?? []).map((row) => [row.vehicle_id, row.price_cents]));
  return cars.map((c) => ({ ...c, price_today_cents: today.get(c.id) ?? c.daily_rate_cents }));
}
