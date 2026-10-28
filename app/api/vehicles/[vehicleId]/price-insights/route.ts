import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AUTO_HORIZON_DAYS } from "@/lib/auto-pricing";
import { previewAutoPrices } from "@/lib/auto-pricing-refresh";
import { tripDays } from "@/lib/pricing";
import { toDateKey } from "@/lib/utils";
import { addDays } from "@/components/host/days";

/**
 * Turo's calendar insights for one car: the dynamic price and the host's price
 * for each coming day, and what booked trips paid a night, month by month.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/vehicles/[vehicleId]/price-insights">) {
  const { vehicleId } = await ctx.params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: car } = await admin
    .from("vehicles")
    .select("id, daily_rate_cents, auto_price_min_cents, auto_price_max_cents, location_lat, location_lng")
    .eq("id", vehicleId)
    .eq("host_id", user.id)
    .maybeSingle();
  if (!car) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const today = toDateKey(new Date());
  const yearAgo = addDays(today, -365);
  const [dynamic, { data: prices }, { data: trips }] = await Promise.all([
    previewAutoPrices(car, AUTO_HORIZON_DAYS),
    admin
      .from("vehicle_daily_prices")
      .select("date, price_cents")
      .eq("vehicle_id", vehicleId)
      .gte("date", today)
      .lt("date", addDays(today, AUTO_HORIZON_DAYS)),
    admin
      .from("trips")
      .select("starts_at, ends_at, base_cents, daily_rate_cents")
      .eq("vehicle_id", vehicleId)
      .in("status", ["approved", "active", "completed"])
      .gte("starts_at", `${yearAgo}T00:00:00Z`),
  ]);

  const own = new Map((prices ?? []).map((p) => [p.date, p.price_cents]));
  const days = dynamic.map(({ date, price }) => ({
    date,
    dynamicCents: price.cents,
    yourCents: own.get(date) ?? car.daily_rate_cents,
  }));

  // A night's price on each booked trip, before discounts, grouped by the month it started.
  const months = new Map<string, { cents: number; nights: number }>();
  for (const t of trips ?? []) {
    const nights = tripDays(t.starts_at, t.ends_at);
    const month = toDateKey(t.starts_at).slice(0, 7);
    const m = months.get(month) ?? { cents: 0, nights: 0 };
    months.set(month, { cents: m.cents + (t.base_cents ?? t.daily_rate_cents * nights), nights: m.nights + nights });
  }
  const booked = [...months]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, m]) => ({ month, nightlyCents: Math.round(m.cents / m.nights), nights: m.nights }));

  return NextResponse.json({ days, booked });
}
