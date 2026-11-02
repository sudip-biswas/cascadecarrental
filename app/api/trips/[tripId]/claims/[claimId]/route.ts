import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { askGuestToPay, closeClaimAsHost, escalateClaim, loadClaim } from "@/lib/claims";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ask_guest"),
    amountCents: z.number().int().min(100).max(2_000_000),
    description: z.string().trim().min(3).max(2000),
  }),
  z.object({ action: z.literal("escalate") }),
  z.object({ action: z.literal("close"), note: z.string().trim().max(2000).default("") }),
]);

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** The host's next step on a claim: ask the guest to pay, escalate, or close it. */
export async function PATCH(req: Request, { params }: { params: Promise<{ tripId: string; claimId: string }> }) {
  const { tripId, claimId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Log in first.", 401);

  const found = await loadClaim(tripId, claimId);
  if (!found || (found.trip.host_id !== user.id && found.trip.guest_id !== user.id)) return fail("Claim not found.", 404);
  if (found.trip.host_id !== user.id) return fail("Only the host can do that.", 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Add an amount of at least $1 and a short note.", 400);
  const input = parsed.data;

  const result =
    input.action === "ask_guest"
      ? await askGuestToPay(found.trip, found.claim, input)
      : input.action === "escalate"
        ? await escalateClaim(found.trip, found.claim)
        : await closeClaimAsHost(found.trip, found.claim, input.note);
  if (!result.ok) return fail(result.error, result.status);
  return NextResponse.json({ ok: true });
}
