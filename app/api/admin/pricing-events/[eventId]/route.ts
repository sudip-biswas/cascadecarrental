import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshAutoPrices } from "@/lib/auto-pricing-refresh";
import { UUID, fail, requireAdminApi } from "@/app/(host)/host/admin/_lib/admin";

/** Removes an event. Automatic prices drop it straight away; booked trips keep what they paid. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/pricing-events/[eventId]">) {
  const { denied } = await requireAdminApi();
  if (denied) return denied;
  const { eventId } = await ctx.params;
  if (!UUID.test(eventId)) return fail("Event not found.", 404);

  const { data, error } = await createAdminClient().from("pricing_events").delete().eq("id", eventId).select("id");
  if (error) return fail("Couldn't remove it. Try again.", 500);
  if (!data.length) return fail("Event not found.", 404);

  await refreshAutoPrices().catch((err) => console.error("[pricing-events] refresh failed", err));
  return NextResponse.json({ ok: true });
}
