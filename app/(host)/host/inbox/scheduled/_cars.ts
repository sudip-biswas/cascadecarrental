import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { CarOption } from "@/components/messaging/scheduled/TemplateForm";

/** The host's cars as short labels for the template form. */
export async function loadCarOptions(supabase: SupabaseClient<Database>, hostId: string): Promise<CarOption[]> {
  const { data } = await supabase
    .from("vehicles")
    .select("id, make, model, year")
    .eq("host_id", hostId)
    .order("created_at", { ascending: true });
  return (data ?? []).map((c) => ({ id: c.id, label: `${c.make} ${c.model} ${c.year}` }));
}
