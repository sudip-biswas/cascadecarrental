import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { addDays, daysBetween } from "@/components/host/days";
import type { PriceChanges } from "@/lib/pricing";
import { refreshAutoPrices } from "@/lib/auto-pricing-refresh";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Price several cars over several days at once, the way Turo's calendar does. */
const schema = z
  .object({
    vehicleIds: z.array(z.string().uuid()).min(1).max(200),
    /** Both days included. */
    from: dateKey,
    to: dateKey,
    change: z.discriminatedUnion("kind", [
      /** Every selected day costs exactly this. */
      z.object({ kind: z.literal("set"), cents: z.number().int().min(100) }),
      /** Each day's current price moves by a percent, rounded to whole dollars. */
      z.object({ kind: z.literal("adjust"), pct: z.number().min(-90).max(500) }),
      /** Each day's current price moves by this many cents, never under $1. */
      z.object({ kind: z.literal("shift"), cents: z.number().int().min(-100_000).max(100_000) }),
      /** Back to the dynamic price, which updates daily with demand. */
      z.object({ kind: z.literal("dynamic") }),
    ]),
  })
  .refine((b) => b.to >= b.from && daysBetween(b.from, b.to) < 366, "Pick up to a year of days.");

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Unauthorized", 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Pick some days and a price.", 400);
  const { vehicleIds, from, to, change } = parsed.data;
  const dates = Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDays(from, i));
  // Small groups of cars keep each read under PostgREST's 1,000-row page.
  const groups = chunks(vehicleIds, Math.max(1, Math.min(50, Math.floor(1000 / dates.length))));

  const { data: cars } = await supabase
    .from("vehicles")
    .select("id, daily_rate_cents, auto_pricing")
    .in("id", vehicleIds)
    .eq("host_id", user.id);
  if (cars?.length !== new Set(vehicleIds).size) return fail("Forbidden", 403);

  const changes: PriceChanges = Object.fromEntries(cars.map((c) => [c.id, {}]));

  if (change.kind === "dynamic") {
    const results = await Promise.all(
      groups.map((ids) =>
        supabase
          .from("vehicle_daily_prices")
          .delete()
          .in("vehicle_id", ids)
          .gte("date", from)
          .lte("date", to)
      )
    );
    if (results.some((r) => r.error)) return fail("Couldn't switch those days back to dynamic.", 500);
    for (const car of cars) for (const d of dates) changes[car.id][d] = null;

    // Dynamic prices come straight back, switching it on for any car that had it off.
    const ids = cars.map((c) => c.id);
    const off = cars.filter((c) => !c.auto_pricing).map((c) => c.id);
    if (off.length) await supabase.from("vehicles").update({ auto_pricing: true }).in("id", off);
    try {
      await refreshAutoPrices(ids);
    } catch (err) {
      console.error("[daily-prices] dynamic refresh failed", err);
    }
    const { data: refilled } = await supabase
      .from("vehicle_daily_prices")
      .select("vehicle_id, date, price_cents")
      .in("vehicle_id", ids)
      .gte("date", from)
      .lte("date", to);
    const auto: Record<string, string[]> = {};
    for (const row of refilled ?? []) {
      changes[row.vehicle_id][row.date] = row.price_cents;
      (auto[row.vehicle_id] ??= []).push(row.date);
    }
    return NextResponse.json({ changes, auto });
  }

  // An adjustment starts from what each day costs now: its own or dynamic price, else the daily rate.
  const current = new Map<string, number>();
  if (change.kind !== "set") {
    for (const car of cars) for (const d of dates) current.set(`${car.id} ${d}`, car.daily_rate_cents);
    const results = await Promise.all(
      groups.map((ids) =>
        supabase
          .from("vehicle_daily_prices")
          .select("vehicle_id, date, price_cents")
          .in("vehicle_id", ids)
          .gte("date", from)
          .lte("date", to)
      )
    );
    for (const { data, error } of results) {
      if (error) return fail("Couldn't read the current prices.", 500);
      for (const row of data) current.set(`${row.vehicle_id} ${row.date}`, row.price_cents);
    }
  }

  const rows = cars.flatMap((car) =>
    dates.map((date) => {
      const now = current.get(`${car.id} ${date}`)!;
      const price_cents =
        change.kind === "set"
          ? change.cents
          : change.kind === "shift"
            ? Math.max(100, now + change.cents)
            : Math.max(100, Math.round((now * (1 + change.pct / 100)) / 100) * 100);
      changes[car.id][date] = price_cents;
      return { vehicle_id: car.id, date, price_cents, source: "host" as const };
    })
  );

  const saved = await Promise.all(
    chunks(rows, 1000).map((batch) =>
      supabase.from("vehicle_daily_prices").upsert(batch, { onConflict: "vehicle_id,date" })
    )
  );
  if (saved.some((r) => r.error)) return fail("Couldn't save prices.", 500);

  return NextResponse.json({ changes, auto: {} });
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
