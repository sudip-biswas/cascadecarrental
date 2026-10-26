import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveCharge } from "@/lib/charges";
import { fail, requireAdminApi } from "@/app/(host)/host/admin/_lib/admin";

const schema = z.object({
  decision: z.enum(["charge", "decline"]),
  note: z.string().trim().max(2000).default(""),
});

/** Cascade's call on a disputed (or unanswered) charge: collect it or drop it. */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/charges/[chargeId]/resolve">) {
  const { denied } = await requireAdminApi();
  if (denied) return denied;
  const { chargeId } = await ctx.params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Pick a decision and keep the note under 2000 characters.", 400);

  const result = await resolveCharge(chargeId, parsed.data.decision, parsed.data.note);
  if (!result.ok) return fail(result.error, 409);
  return NextResponse.json(result);
}
