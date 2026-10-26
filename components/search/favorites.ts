import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Who is looking and which cars they've saved, for the hearts on cards. */
export async function loadFavorites(supabase: SupabaseClient<Database>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, saved: new Set<string>() };

  const { data } = await supabase.from("favorites").select("vehicle_id").eq("user_id", user.id);
  return { userId: user.id, saved: new Set((data ?? []).map((f) => f.vehicle_id)) };
}
