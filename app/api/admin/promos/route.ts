import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { zonedInstant } from "@/lib/utils";
import { fail, requireAdminApi } from "@/app/(host)/host/admin/_lib/admin";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const schema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((s) => s.toUpperCase())
      .pipe(z.string().regex(/^[A-Z0-9-]{3,24}$/)),
    description: z.string().trim().max(200).optional(),
    percentOff: z.number().int().min(1).max(100).nullable(),
    amountOffCents: z.number().int().positive().max(100_000).nullable(),
    maxRedemptions: z.number().int().positive().nullable(),
    perUserLimit: z.number().int().min(1).max(100).default(1),
    minDays: z.number().int().min(1).max(60).default(1),
    firstTripOnly: z.boolean().default(false),
    /** Pacific dates. Starts at midnight; ends at the end of the day given. */
    startsOn: dateKey.nullable(),
    endsOn: dateKey.nullable(),
  })
  .refine((v) => (v.percentOff == null) !== (v.amountOffCents == null), { message: "one-discount" })
  .refine((v) => !v.startsOn || !v.endsOn || v.endsOn >= v.startsOn, { message: "dates" });

export async function POST(req: Request) {
  const { denied } = await requireAdminApi();
  if (denied) return denied;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.message === "one-discount") return fail("Pick a percent off or an amount off, not both.", 400);
    if (issue?.message === "dates") return fail("The end date has to be on or after the start.", 400);
    if (issue?.path[0] === "code") return fail("Codes are 3 to 24 letters, numbers or dashes.", 400);
    return fail("Something's off with this code. Check the fields.", 400);
  }
  const p = parsed.data;

  let expiresAt: string | null = null;
  if (p.endsOn) {
    const next = new Date(`${p.endsOn}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    expiresAt = zonedInstant(next.toISOString().slice(0, 10), "00:00").toISOString();
  }

  const { data, error } = await createAdminClient()
    .from("promo_codes")
    .insert({
      code: p.code,
      description: p.description || null,
      percent_off: p.percentOff,
      amount_off_cents: p.amountOffCents,
      max_redemptions: p.maxRedemptions,
      per_user_limit: p.perUserLimit,
      min_days: p.minDays,
      first_trip_only: p.firstTripOnly,
      starts_at: p.startsOn ? zonedInstant(p.startsOn, "00:00").toISOString() : null,
      expires_at: expiresAt,
      active: true,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return fail(`${p.code} already exists.`, 409);
  if (error || !data) return fail("Couldn't create the code. Try again.", 500);

  return NextResponse.json({ id: data.id });
}
