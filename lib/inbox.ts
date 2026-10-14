import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Messages sent to this person that they haven't opened, as guest or host. */
export async function unreadCount(
  supabase: SupabaseClient<Database>,
  userId: string,
  as?: "guest" | "host"
): Promise<number> {
  let query = supabase
    .from("messages")
    .select("id, conversations!inner(guest_id, host_id)", { count: "exact", head: true })
    .is("read_at", null)
    .neq("sender_id", userId);
  if (as === "guest") query = query.eq("conversations.guest_id", userId);
  if (as === "host") query = query.eq("conversations.host_id", userId);
  const { count } = await query;
  return count ?? 0;
}

/** Booking requests waiting on this host. */
export async function pendingRequestCount(
  supabase: SupabaseClient<Database>,
  hostId: string
): Promise<number> {
  const { count } = await supabase
    .from("trips")
    .select("id", { count: "exact", head: true })
    .eq("host_id", hostId)
    .eq("status", "pending")
    .eq("payment_status", "authorized");
  return count ?? 0;
}
