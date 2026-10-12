import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Clock } from "lucide-react";

export const instant = false;
export const metadata = { title: "Hours" };

export default async function HostHoursPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, make, model, year, advance_notice_hours, min_trip_days, max_trip_days")
    .eq("host_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold text-cascade-900 mb-2">Hours &amp; availability</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Trip length and advance notice settings per vehicle.
      </p>

      {!vehicles?.length ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <Clock className="w-10 h-10 opacity-30" />
          <p className="text-sm">No vehicles listed yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="bg-white border border-border rounded-xl p-4"
            >
              <p className="font-medium text-cascade-900 text-sm mb-3">
                {v.year} {v.make} {v.model}
              </p>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Advance notice</p>
                  <p className="font-medium text-cascade-900 mt-0.5">
                    {v.advance_notice_hours ?? 0}h
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Min trip</p>
                  <p className="font-medium text-cascade-900 mt-0.5">
                    {v.min_trip_days ?? 1} day{(v.min_trip_days ?? 1) !== 1 ? "s" : ""}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Max trip</p>
                  <p className="font-medium text-cascade-900 mt-0.5">
                    {v.max_trip_days ? `${v.max_trip_days} days` : "No limit"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
