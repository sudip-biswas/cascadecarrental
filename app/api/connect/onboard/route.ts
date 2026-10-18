import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";

function earningsUrl(req: Request) {
  // Derive origin from the request so this works in any env without NEXT_PUBLIC_APP_URL
  const { origin } = new URL(req.url);
  return `${origin}/host/business/earnings`;
}

/**
 * POST — start or resume Stripe Connect Express onboarding.
 * Creates an Express account if the host doesn't have one yet, then
 * returns a short-lived Stripe-hosted onboarding URL.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  try {
    // Get or create the host's Stripe Connect account
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_account_id, full_name")
      .eq("id", user.id)
      .single();

    let accountId = profile?.stripe_account_id ?? null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: user.email,
        capabilities: { transfers: { requested: true } },
        settings: { payouts: { schedule: { interval: "weekly", weekly_anchor: "monday" } } },
      });
      accountId = account.id;
      await admin
        .from("profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", user.id);
    }

    const base = earningsUrl(req);

    // Build a fresh onboarding link (they expire after 24 h)
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${base}?payout_setup=refresh`,
      return_url: `${base}?payout_setup=done`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    console.error("[connect/onboard]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET — return a Stripe Express dashboard login link for an existing account.
 * Used by the "Manage payouts" button once onboarding is complete.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_account_id) {
    return NextResponse.json({ error: "No Connect account" }, { status: 404 });
  }

  try {
    const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id);
    return NextResponse.json({ url: loginLink.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    console.error("[connect/onboard GET]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
