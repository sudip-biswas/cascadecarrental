import { createAdminClient } from "@/lib/supabase/admin";
import { pluralize } from "@/lib/utils";
import type { PromoTerms } from "@/lib/pricing";

export type PromoCheck =
  | { ok: true; terms: PromoTerms & { description: string | null } }
  | { ok: false; error: string };

/** Codes are stored upper case: "save10 " is SAVE10. */
export function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

/**
 * Whether a guest can use a promo code on a trip of this many days, and what it
 * takes off. Run by /api/promo for the preview and again by /api/checkout.
 */
export async function checkPromo(code: string, guestId: string, days: number): Promise<PromoCheck> {
  const admin = createAdminClient();
  const { data: promo } = await admin.from("promo_codes").select("*").eq("code", normalizeCode(code)).maybeSingle();
  if (!promo || !promo.active) return { ok: false, error: "That code doesn't work." };

  const now = Date.now();
  if (promo.starts_at && Date.parse(promo.starts_at) > now) return { ok: false, error: "That code isn't active yet." };
  if (promo.expires_at && Date.parse(promo.expires_at) <= now) return { ok: false, error: "That code has expired." };
  if (days < promo.min_days) {
    return { ok: false, error: `That code needs a trip of at least ${pluralize(promo.min_days, "day")}.` };
  }

  // Real bookings only: cancelled trips and checkouts that never finished don't count.
  const booked = () =>
    admin
      .from("trips")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(cancelled_guest,cancelled_host)")
      .or("status.neq.pending,payment_status.not.in.(pending,failed)");

  const [{ count: used }, { count: usedByGuest }, { count: guestTrips }] = await Promise.all([
    promo.max_redemptions ? booked().eq("promo_code", promo.code) : Promise.resolve({ count: 0 }),
    booked().eq("promo_code", promo.code).eq("guest_id", guestId),
    promo.first_trip_only ? booked().eq("guest_id", guestId) : Promise.resolve({ count: 0 }),
  ]);
  if (promo.max_redemptions && (used ?? 0) >= promo.max_redemptions) {
    return { ok: false, error: "That code has been used up." };
  }
  if ((usedByGuest ?? 0) >= promo.per_user_limit) return { ok: false, error: "You've already used that code." };
  if (promo.first_trip_only && (guestTrips ?? 0) > 0) return { ok: false, error: "That code is for your first trip." };

  return {
    ok: true,
    terms: {
      code: promo.code,
      percentOff: promo.percent_off,
      amountOffCents: promo.amount_off_cents,
      description: promo.description,
    },
  };
}
