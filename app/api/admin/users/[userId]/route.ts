import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";
import { fail, requireAdminApi } from "@/app/(host)/host/admin/_lib/admin";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

const schema = z
  .object({
    licenceVerified: z.boolean(),
    identityVerified: z.boolean(),
    suspended: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0);

/**
 * Manual checks and suspension. Suspending also takes every car of theirs off
 * search; lifting it brings them back as unlisted, for the host to relist.
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/users/[userId]">) {
  const { user, denied } = await requireAdminApi();
  if (denied) return denied;
  const { userId } = await ctx.params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Nothing to change.", 400);
  const { licenceVerified, identityVerified, suspended } = parsed.data;
  if (suspended && userId === user.id) return fail("You can't suspend yourself.", 400);

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("id, suspended_at").eq("id", userId).maybeSingle();
  if (!profile) return fail("User not found.", 404);

  const now = new Date().toISOString();
  const update: ProfileUpdate = { updated_at: now };
  if (licenceVerified !== undefined) update.driving_license_verified = licenceVerified;
  if (identityVerified !== undefined) {
    update.identity_verified = identityVerified;
    update.identity_status = identityVerified ? "verified" : "unverified";
    update.identity_error = null;
  }
  if (suspended !== undefined) update.suspended_at = suspended ? (profile.suspended_at ?? now) : null;

  const { error } = await admin.from("profiles").update(update).eq("id", userId);
  if (error) return fail("Couldn't save. Try again.", 500);

  if (suspended === true) {
    await admin.from("vehicles").update({ status: "suspended", updated_at: now }).eq("host_id", userId).neq("status", "suspended");
  } else if (suspended === false) {
    await admin.from("vehicles").update({ status: "unlisted", updated_at: now }).eq("host_id", userId).eq("status", "suspended");
  }

  return NextResponse.json({ ok: true });
}
