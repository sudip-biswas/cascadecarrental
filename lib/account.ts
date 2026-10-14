import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { pendingRequestCount, unreadCount } from "@/lib/inbox";

/** Who's signed in, for the nav. Cached so the header and tab bar share one lookup. */
export const getGuestNav = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, unread] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    unreadCount(supabase, user.id, "guest"),
  ]);
  return { initial: (profile?.full_name || user.email || "?")[0].toUpperCase(), unread };
});

export const getHostNav = cache(async (hostId: string) => {
  const supabase = await createClient();
  const [unread, requests] = await Promise.all([
    unreadCount(supabase, hostId, "host"),
    pendingRequestCount(supabase, hostId),
  ]);
  return { unread, requests };
});
