import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/utils";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = safeRedirect(searchParams.get("next"));
  const email = searchParams.get("email") ?? "";

  // Token-hash flow (server-generated magic link): works in any browser, no PKCE binding.
  if (tokenHash && type === "magiclink") {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    // On failure, offer a resend on the login page.
    const params = new URLSearchParams({ error: "auth_callback_failed" });
    if (email) params.set("email", email);
    if (next !== "/") params.set("next", next);
    return NextResponse.redirect(`${origin}/login?${params}`);
  }

  // PKCE flow (browser sign-in with signInWithOtp).
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
