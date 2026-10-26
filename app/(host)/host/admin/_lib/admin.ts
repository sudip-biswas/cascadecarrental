import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { toDateKey, zonedInstant } from "@/lib/utils";

/** Signed photo links last an hour: long enough to review a case. */
const PHOTO_TTL_S = 60 * 60;

export function isAdmin(user: Pick<User, "id"> | null) {
  return !!user && !!process.env.ADMIN_USER_ID && user.id === process.env.ADMIN_USER_ID;
}

/** For admin pages: sends anyone else away before any data loads. */
export async function requireAdminPage(path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=${path}`);
  if (!isAdmin(user)) redirect("/host");
  return user;
}

export function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** For admin API routes: the admin, or the response to send back instead. */
export async function requireAdminApi(): Promise<{ user: User; denied?: never } | { user?: never; denied: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { denied: fail("Log in first.", 401) };
  if (!isAdmin(user)) return { denied: fail("Only Cascade staff can do that.", 403) };
  return { user };
}

/** Emails live in auth, not profiles. Fine for the handful on one admin page. */
export async function emailsFor(ids: string[]): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const unique = [...new Set(ids)];
  const found = await Promise.all(
    unique.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      return [id, data.user?.email ?? ""] as const;
    })
  );
  return Object.fromEntries(found);
}

/** People whose email contains `q`. Walks the auth user list, which is small. */
export async function usersByEmail(q: string, limit = 50): Promise<{ id: string; email: string }[]> {
  const admin = createAdminClient();
  const needle = q.trim().toLowerCase();
  const hits: { id: string; email: string }[] = [];
  for (let page = 1; page <= 20 && hits.length < limit; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    for (const u of data.users) {
      if (u.email?.toLowerCase().includes(needle)) hits.push({ id: u.id, email: u.email });
    }
    if (data.users.length < 1000) break;
  }
  return hits.slice(0, limit);
}

/** Signed links for paths in the private trip-photos bucket, keyed by path. */
export async function signedPhotos(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return {};
  const { data } = await createAdminClient().storage.from("trip-photos").createSignedUrls(unique, PHOTO_TTL_S);
  const urls: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl;
  return urls;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Midnight to midnight, Pacific, today. Safe across clock changes. */
export function todayBounds(now = new Date()) {
  const start = zonedInstant(toDateKey(now), "00:00");
  const end = zonedInstant(toDateKey(new Date(start.getTime() + 30 * 60 * 60 * 1000)), "00:00");
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * What's left to refund on a payment: captured minus already refunded, straight
 * from Stripe so manual refunds and cancellations can't add up to more than was paid.
 */
export async function refundableCents(paymentIntentId: string): Promise<{ capturedCents: number; refundedCents: number; leftCents: number }> {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
  const charge = pi.latest_charge && typeof pi.latest_charge !== "string" ? pi.latest_charge : null;
  if (pi.status !== "succeeded" || !charge) return { capturedCents: 0, refundedCents: 0, leftCents: 0 };
  return {
    capturedCents: charge.amount_captured,
    refundedCents: charge.amount_refunded,
    leftCents: Math.max(0, charge.amount_captured - charge.amount_refunded),
  };
}
