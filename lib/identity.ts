import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";

type Session = Stripe.Identity.VerificationSession;

/** What the profile page shows for a licence check. */
export type IdentityStatus = "unverified" | "pending" | "verified" | "failed";

/** "2001-04-09" from Stripe's { day, month, year }. Null when any part is missing. */
function dobKey(dob: Stripe.Identity.VerificationSession.VerifiedOutputs.Dob | null | undefined): string | null {
  if (!dob?.year || !dob.month || !dob.day) return null;
  return `${dob.year}-${String(dob.month).padStart(2, "0")}-${String(dob.day).padStart(2, "0")}`;
}

/** Why a check failed, in Stripe's words, for the profile page. */
function failureReason(session: Session): string {
  return session.last_error?.reason || "We couldn't match the licence and the selfie.";
}

/**
 * Writes a verification session's outcome to its owner's profile and tells
 * them when it changes. Webhooks and the return from Stripe both land here,
 * so it's safe to run twice. Returns the status it left the profile in.
 */
export async function applyVerificationSession(session: Session): Promise<IdentityStatus | null> {
  const userId = session.metadata?.user_id;
  if (!userId) return null;

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("identity_status, identity_session_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  const current = profile.identity_status as IdentityStatus;
  // A passed check stays passed, and an old session can't overwrite a newer one.
  if (current === "verified") return current;
  if (session.status !== "verified" && profile.identity_session_id && profile.identity_session_id !== session.id) {
    return current;
  }

  const now = new Date().toISOString();
  switch (session.status) {
    case "verified": {
      // The date of birth only comes back when asked for by name.
      const full =
        session.verified_outputs?.dob !== undefined
          ? session
          : await stripe.identity.verificationSessions.retrieve(session.id, {
              expand: ["verified_outputs", "verified_outputs.dob"],
            });
      const dob = dobKey(full.verified_outputs?.dob);
      await admin
        .from("profiles")
        .update({
          driving_license_verified: true,
          identity_verified: true,
          identity_status: "verified",
          identity_session_id: session.id,
          identity_error: null,
          ...(dob ? { date_of_birth: dob } : {}),
          updated_at: now,
        })
        .eq("id", userId);
      await notify({
        userId,
        kind: "identity_verified",
        title: "Your licence is checked",
        body: "You're ready to drive. Hosts see a checkmark, never the photo.",
        href: "/profile",
        dedupeKey: `identity:${session.id}:verified`,
        actionLabel: "See your profile",
      });
      return "verified";
    }

    case "requires_input": {
      // A new session waits for input too; it has only failed once there's an error.
      if (!session.last_error) return current;
      const reason = failureReason(session);
      await admin
        .from("profiles")
        .update({ identity_status: "failed", identity_session_id: session.id, identity_error: reason, updated_at: now })
        .eq("id", userId);
      await notify({
        userId,
        kind: "identity_failed",
        title: "Your licence check didn't go through",
        body: `${reason}\nYou can try again from your profile.`,
        href: "/profile",
        dedupeKey: `identity:${session.id}:failed:${session.last_error.code ?? "unknown"}`,
        actionLabel: "Try again",
      });
      return "failed";
    }

    case "processing":
      if (current !== "pending") {
        await admin
          .from("profiles")
          .update({ identity_status: "pending", identity_session_id: session.id, identity_error: null, updated_at: now })
          .eq("id", userId);
      }
      return "pending";

    case "canceled":
      await admin
        .from("profiles")
        .update({ identity_status: "unverified", identity_session_id: null, identity_error: null, updated_at: now })
        .eq("id", userId);
      if (current === "pending") {
        await notify({
          userId,
          kind: "identity_canceled",
          title: "Your licence check was cancelled",
          body: "Start a new one from your profile whenever you're ready.",
          href: "/profile",
          dedupeKey: `identity:${session.id}:canceled`,
          email: false,
        });
      }
      return "unverified";
  }
  return current;
}

/** Handles identity.verification_session.* webhook events. True when it was one. */
export async function handleIdentityEvent(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case "identity.verification_session.verified":
    case "identity.verification_session.requires_input":
    case "identity.verification_session.processing":
    case "identity.verification_session.canceled":
      await applyVerificationSession(event.data.object);
      return true;
    default:
      return false;
  }
}
