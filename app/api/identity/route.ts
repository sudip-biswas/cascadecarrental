import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripe } from "@/lib/stripe/server";
import { applyVerificationSession } from "@/lib/identity";

function fail(error: string, status: number, code?: string) {
  return NextResponse.json({ error, code }, { status });
}

/** Stripe says this when Identity hasn't been switched on for the account. */
function identityOff(err: unknown): boolean {
  return (
    err instanceof Stripe.errors.StripeError &&
    /identity/i.test(err.message) &&
    /(enable|activat|application|onboard)/i.test(err.message)
  );
}

/**
 * Starts a driving licence check: a photo of the licence and a live selfie
 * that has to match it. Returns Stripe's page to send the guest to.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Log in to check your licence.", 401);

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("identity_status, identity_session_id")
    .eq("id", user.id)
    .single();
  if (!profile) return fail("We couldn't find your profile.", 404);
  if (profile.identity_status === "verified") return fail("Your licence is already checked.", 400);

  const { origin } = new URL(req.url);
  let session: Stripe.Identity.VerificationSession;
  try {
    // Reuse the open session when there is one, so a second click doesn't start a second check.
    if (profile.identity_session_id && profile.identity_status === "pending") {
      const open = await stripe.identity.verificationSessions.retrieve(profile.identity_session_id);
      if (open.status === "requires_input" && !open.last_error && open.url) {
        return NextResponse.json({ url: open.url });
      }
      if (open.status === "processing") return fail("Your check is being looked at. It usually takes a few minutes.", 409);
    }
    session = await stripe.identity.verificationSessions.create({
      type: "document",
      options: {
        document: {
          allowed_types: ["driving_license"],
          require_matching_selfie: true,
          require_live_capture: true,
        },
      },
      metadata: { user_id: user.id },
      provided_details: user.email ? { email: user.email } : undefined,
      return_url: `${origin}/profile?verify=done`,
    });
  } catch (err) {
    console.error("[identity] create failed", err);
    if (identityOff(err)) {
      return fail("Licence checks aren't switched on for Cascade's Stripe account yet.", 503, "identity_disabled");
    }
    return fail("We couldn't start the check. Try again in a minute.", 502);
  }

  const { error } = await admin
    .from("profiles")
    .update({
      identity_session_id: session.id,
      identity_status: "pending",
      identity_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (error) return fail("We couldn't start the check. Try again in a minute.", 500);

  return NextResponse.json({ url: session.url });
}

/** Catches up with Stripe when the guest comes back, in case the webhook hasn't landed yet. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Log in first.", 401);

  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("identity_status, identity_session_id, identity_error")
    .eq("id", user.id)
    .single();
  if (!profile) return fail("We couldn't find your profile.", 404);
  if (!profile.identity_session_id || profile.identity_status === "verified") {
    return NextResponse.json({ status: profile.identity_status, error: profile.identity_error });
  }

  try {
    const session = await stripe.identity.verificationSessions.retrieve(profile.identity_session_id, {
      expand: ["verified_outputs", "verified_outputs.dob"],
    });
    if (session.metadata?.user_id !== user.id) return fail("That check isn't yours.", 403);
    const status = await applyVerificationSession(session);
    return NextResponse.json({
      status: status ?? profile.identity_status,
      error: status === "failed" ? (session.last_error?.reason ?? null) : null,
    });
  } catch (err) {
    console.error("[identity] sync failed", err);
    return NextResponse.json({ status: profile.identity_status, error: profile.identity_error });
  }
}
