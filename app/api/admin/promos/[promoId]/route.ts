import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID, fail, requireAdminApi } from "@/app/(host)/host/admin/_lib/admin";

const schema = z.object({ active: z.boolean() });

/** Turns a code off (or back on). Trips that already used it keep their discount. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/promos/[promoId]">) {
  const { denied } = await requireAdminApi();
  if (denied) return denied;
  const { promoId } = await ctx.params;
  if (!UUID.test(promoId)) return fail("Code not found.", 404);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Nothing to change.", 400);

  const { data, error } = await createAdminClient()
    .from("promo_codes")
    .update({ active: parsed.data.active })
    .eq("id", promoId)
    .select("id")
    .maybeSingle();
  if (error) return fail("Couldn't save. Try again.", 500);
  if (!data) return fail("Code not found.", 404);

  return NextResponse.json({ ok: true });
}
