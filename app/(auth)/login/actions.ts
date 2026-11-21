"use server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { SITE_URL } from "@/lib/site";

export async function resendSignInLink(email: string, next: string): Promise<{ ok: boolean; error?: string }> {
  if (!email) return { ok: false, error: "Enter your email." };
  const admin = createAdminClient();
  try {
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokenHash = (linkData as any)?.properties?.hashed_token as string | undefined;
    if (!tokenHash) return { ok: false, error: "Could not generate sign-in link. Try again." };
    const nextEncoded = encodeURIComponent(next || "/");
    const confirmUrl = `${SITE_URL}/confirm?token_hash=${encodeURIComponent(tokenHash)}&next=${nextEncoded}&email=${encodeURIComponent(email)}`;
    await sendEmail({
      to: email,
      subject: "Your sign-in link for Cascade",
      lines: ["Tap the button below to sign in to your Cascade account."],
      action: { label: "Sign in to Cascade", href: confirmUrl },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "Failed to send link. Try again." };
  }
}
