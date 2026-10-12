import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MapPin } from "lucide-react";

export const instant = false;
export const metadata = { title: "Locations" };

export default async function HostLocationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, make, model, year, location_name, location_address, status")
    .eq("host_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold text-cascade-900 mb-6">Locations</h1>

      {!vehicles?.length ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <MapPin className="w-10 h-10 opacity-30" />
          <p className="text-sm">No vehicles listed yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="bg-white border border-border rounded-xl p-4 flex items-center gap-4"
            >
              <MapPin className="w-5 h-5 text-cascade-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-cascade-900 text-sm">
                  {v.year} {v.make} {v.model}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {v.location_address ?? v.location_name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
