import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID, fail, requireAdminApi } from "@/app/(host)/host/admin/_lib/admin";

const schema = z.object({ status: z.enum(["open", "resolved"]) });

/** Marks a listing report sorted, or opens it again. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/reports/[reportId]">) {
  const { denied } = await requireAdminApi();
  if (denied) return denied;
  const { reportId } = await ctx.params;
  if (!UUID.test(reportId)) return fail("Report not found.", 404);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Nothing to change.", 400);
  const resolved = parsed.data.status === "resolved";

  const { data, error } = await createAdminClient()
    .from("listing_reports")
    .update({ status: parsed.data.status, resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", reportId)
    .select("id")
    .maybeSingle();
  // Reopening clashes with a newer open report from the same person.
  if (error?.code === "23505") return fail("This person has a newer open report on the same car.", 409);
  if (error) return fail("Couldn't save. Try again.", 500);
  if (!data) return fail("Report not found.", 404);

  return NextResponse.json({ ok: true });
}
