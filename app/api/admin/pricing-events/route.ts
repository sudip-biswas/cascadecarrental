import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAutoPrices } from "@/lib/auto-pricing-refresh";
import { fail, requireAdminApi } from "@/app/(host)/host/admin/_lib/admin";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schema = z
  .object({
    name: z.string().trim().min(1).max(80),
    startsOn: dateKey,
    endsOn: dateKey,
    pct: z.number().int().min(-30).max(50).refine((n) => n !== 0),
  })
  .refine((v) => v.endsOn >= v.startsOn, { message: "dates" });

/** Adds a date that moves automatic prices, then reprices the cars that use them. */
export async function POST(req: Request) {
  const { denied } = await requireAdminApi();
  if (denied) return denied;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    if (parsed.error.issues[0]?.message === "dates") return fail("The last day has to be on or after the first.", 400);
    return fail("Give it a name, dates and a percent from -30 to 50.", 400);
  }
  const p = parsed.data;

  const { error } = await createAdminClient()
    .from("pricing_events")
    .insert({ name: p.name, starts_on: p.startsOn, ends_on: p.endsOn, pct: p.pct });
  if (error) return fail("Couldn't add the event. Try again.", 500);

  await refreshAutoPrices().catch((err) => console.error("[pricing-events] refresh failed", err));
  return NextResponse.json({ ok: true });
}
