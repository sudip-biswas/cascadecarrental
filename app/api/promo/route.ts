import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { tripDays } from "@/lib/pricing";
import { zonedInstant } from "@/lib/utils";
import { checkPromo } from "./check";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schema = z.object({
  code: z.string().trim().min(1).max(40),
  vehicleId: z.string().uuid(),
  from: dateKey,
  until: dateKey,
  fromTime: z.string().regex(/^\d{2}:\d{2}$/).default("10:00"),
  untilTime: z.string().regex(/^\d{2}:\d{2}$/).default("10:00"),
});

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** Checks a promo code for a trip and returns what it takes off. Checkout checks it again. */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Log in to use a code.", 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Enter a code.", 400);
  const { code, vehicleId, from, until, fromTime, untilTime } = parsed.data;

  const { data: vehicle } = await supabase.from("vehicles").select("id").eq("id", vehicleId).eq("status", "listed").maybeSingle();
  if (!vehicle) return fail("This car isn't available any more.", 404);

  const startsAt = zonedInstant(from, fromTime);
  const endsAt = zonedInstant(until, untilTime);
  if (endsAt <= startsAt) return fail("The return date has to be after pick-up.", 400);

  const result = await checkPromo(code, user.id, tripDays(startsAt, endsAt));
  if (!result.ok) return fail(result.error, 400);
  return NextResponse.json(result.terms);
}
