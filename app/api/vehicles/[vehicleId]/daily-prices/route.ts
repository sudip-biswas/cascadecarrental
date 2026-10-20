import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(366),
  /** null = delete the override (reset to base rate) */
  priceCents: z.number().int().min(100).nullable(),
});

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

async function ownCar(vehicleId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: fail("Unauthorized", 401) };

  const { data } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("host_id", user.id)
    .maybeSingle();
  if (!data) return { supabase, error: fail("Forbidden", 403) };
  return { supabase, error: null };
}

/** PATCH — upsert or delete per-day price overrides for one vehicle. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ vehicleId: string }> }
) {
  const { vehicleId } = await params;
  const { supabase, error: denied } = await ownCar(vehicleId);
  if (denied) return denied;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("Invalid request body.", 400);
  }
  const { dates, priceCents } = parsed.data;

  if (priceCents === null) {
    // Delete overrides for those dates
    const { error } = await supabase
      .from("vehicle_daily_prices")
      .delete()
      .eq("vehicle_id", vehicleId)
      .in("date", dates);
    if (error) return fail("Couldn't reset prices.", 500);
    return NextResponse.json({ success: true });
  }

  // Upsert per-day price overrides
  const rows = dates.map((date) => ({
    vehicle_id: vehicleId,
    date,
    price_cents: priceCents,
  }));

  const { error } = await supabase
    .from("vehicle_daily_prices")
    .upsert(rows, { onConflict: "vehicle_id,date" });
  if (error) return fail("Couldn't save prices.", 500);

  return NextResponse.json({ success: true });
}
