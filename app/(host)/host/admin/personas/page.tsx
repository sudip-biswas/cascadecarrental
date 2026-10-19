import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NO_INDEX } from "@/lib/site";
import { PageTitle } from "@/components/kit";
import { PersonaManager } from "@/components/host/PersonaManager";

export const instant = false;
export const metadata = { title: "Personas", ...NO_INDEX };

export default async function PersonasPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/admin/personas");
  if (user.id !== process.env.ADMIN_USER_ID) redirect("/host");

  const admin = createAdminClient();

  const [{ data: personas }, { data: vehicles }] = await Promise.all([
    admin.from("host_personas").select("id, name, host_since").eq("owner_id", user.id).order("created_at"),
    admin.from("vehicles").select("id, make, model, year, persona_id").eq("host_id", user.id).neq("status", "suspended").order("make"),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4">
      <PageTitle title="Personas" />
      <PersonaManager
        userId={user.id}
        initialPersonas={personas ?? []}
        vehicles={vehicles ?? []}
      />
    </div>
  );
}
