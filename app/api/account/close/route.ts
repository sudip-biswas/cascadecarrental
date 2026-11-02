import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { closeAccount, closureRefusal } from "@/lib/account-closure";

const schema = z.object({ confirm: z.literal("CLOSE") });

function fail(error: string, status: number, reason?: string) {
  return NextResponse.json({ error, reason }, { status });
}

/**
 * Closes the signed-in person's account, if nothing's open. Safe to send again
 * after a failure: it picks up where it stopped.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Log in to close your account.", 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Type CLOSE to confirm.", 400);

  try {
    const refusal = await closureRefusal(user.id);
    if (refusal) return fail(refusal.message, 409, refusal.reason);
    if (!(await closeAccount(user.id))) {
      return fail("You have a booking request open. Cancel it or wait for an answer first.", 409, "trip_requested");
    }
  } catch (err) {
    console.error("[account] close failed", user.id, err);
    return fail("Couldn't finish closing your account. Try again.", 500);
  }

  // Ends every session, and clears this browser's cookies. The ban has already
  // landed, so a failure here changes nothing.
  await supabase.auth.signOut({ scope: "global" }).catch((err) => console.error("[account] sign out failed", user.id, err));
  return NextResponse.json({ ok: true });
}
