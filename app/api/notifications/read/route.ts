import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  // Leave out to mark everything read.
  ids: z.array(z.string().uuid()).max(200).optional(),
});

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** Marks the caller's notifications read once they've seen them. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Unauthorized", 401);

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("Invalid request", 400);
  const { ids } = parsed.data;
  if (ids?.length === 0) return NextResponse.json({ ok: true });

  let query = createAdminClient()
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
  if (ids) query = query.in("id", ids);
  const { error } = await query;
  if (error) return fail("Couldn't update notifications", 500);

  return NextResponse.json({ ok: true });
}
