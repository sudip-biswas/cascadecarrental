import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { clearAutoPrices, refreshAutoPrices } from "@/lib/auto-pricing-refresh";

const schema = z
  .object({
    on: z.boolean(),
    /** Null keeps the default floor or ceiling. */
    minCents: z.number().int().min(100).max(1_000_000).nullable(),
    maxCents: z.number().int().min(100).max(1_000_000).nullable(),
  })
  .refine((b) => b.minCents == null || b.maxCents == null || b.maxCents >= b.minCents, "ceiling");

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** Turns automatic pricing on or off for a car and sets its floor and ceiling. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/vehicles/[vehicleId]/auto-pricing">) {
  const { vehicleId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Unauthorized", 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail(
      parsed.error.issues[0]?.message === "ceiling" ? "The highest price can't be under the lowest." : "Check the prices.",
      400
    );
  }
  const { on, minCents, maxCents } = parsed.data;

  const { data, error } = await supabase
    .from("vehicles")
    .update({
      auto_pricing: on,
      auto_price_min_cents: minCents,
      auto_price_max_cents: maxCents,
      updated_at: new Date().toISOString(),
    })
    .eq("id", vehicleId)
    .eq("host_id", user.id)
    .select("id");
  if (error) return fail("Couldn't save that. Try again.", 500);
  if (!data.length) return fail("Forbidden", 403);

  try {
    if (on) await refreshAutoPrices([vehicleId]);
    else await clearAutoPrices(vehicleId);
  } catch (err) {
    console.error("[auto-pricing] refresh failed", err);
    return fail("Saved, but the prices didn't update. They will tonight.", 500);
  }
  return NextResponse.json({ ok: true });
}
