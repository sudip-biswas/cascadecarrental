import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveClaim } from "@/lib/claims";
import { fail, requireAdminApi } from "@/app/(host)/host/admin/_lib/admin";

const schema = z.object({
  decision: z.enum(["resolved", "closed"]),
  note: z.string().trim().min(3).max(2000),
});

/** Cascade's outcome on a claim: a note both sides see, then resolved or closed. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/claims/[claimId]/resolve">) {
  const { denied } = await requireAdminApi();
  if (denied) return denied;
  const { claimId } = await ctx.params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Pick an outcome and add a short note.", 400);

  const result = await resolveClaim(claimId, parsed.data.decision, parsed.data.note);
  if (!result.ok) return fail(result.error, result.status);
  return NextResponse.json({ ok: true });
}
