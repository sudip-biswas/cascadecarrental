"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeRedirect } from "@/lib/utils";

/**
 * Handles magic links generated server-side via admin.generateLink(), which use the
 * implicit OAuth flow (tokens delivered as #access_token in the URL hash rather than
 * a PKCE ?code= query param). The browser Supabase client detects hash tokens
 * automatically on init; we just wait for the session and redirect.
 */
function MagicHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let done = false;

    function go(session: unknown) {
      if (!session || done) return;
      done = true;
      const next = safeRedirect(searchParams.get("next"));
      router.replace(next);
      router.refresh();
    }

    // Supabase browser client processes #access_token from the URL hash on init and
    // fires onAuthStateChange(SIGNED_IN). Register the listener first, then also
    // check getSession() in case the event already fired before we subscribed.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      go(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => go(session));

    const timer = setTimeout(() => {
      if (!done) setFailed(true);
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [router, searchParams]);

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-4 p-12 text-center">
        <p className="text-[17px] font-bold">That sign-in link didn&apos;t work</p>
        <p className="text-[15px] text-slate">
          It may have expired — links are single-use and valid for one hour.
        </p>
        <Link
          href="/login"
          className="rounded-[14px] bg-ink px-5 py-3 text-sm font-bold text-white"
        >
          Sign in again
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-12">
      <p className="text-[15px] text-slate">Signing you in…</p>
    </div>
  );
}

export default function MagicPage() {
  return (
    <Suspense>
      <MagicHandler />
    </Suspense>
  );
}
