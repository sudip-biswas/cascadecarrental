import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Star, TrendingUp, Car, Clock } from "lucide-react";

export const instant = false;
export const metadata = { title: "Performance" };

export default async function HostPerformancePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, make, model, year, rating_avg, trip_count, status")
    .eq("host_id", user.id)
    .order("trip_count", { ascending: false });

  const totalTrips = vehicles?.reduce((sum, v) => sum + v.trip_count, 0) ?? 0;
  const listedVehicles = vehicles?.filter((v) => v.status === "listed").length ?? 0;
  const avgRating =
    vehicles && vehicles.length > 0
      ? vehicles.reduce((sum, v) => sum + (v.rating_avg ?? 0), 0) / vehicles.length
      : 0;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <h1 className="text-xl font-bold text-cascade-900">Performance</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total trips</p>
          <p className="text-2xl font-bold text-cascade-900">{totalTrips}</p>
          <TrendingUp className="w-4 h-4 text-alpine-500" />
        </div>
        <div className="bg-white border border-border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Listed cars</p>
          <p className="text-2xl font-bold text-cascade-900">{listedVehicles}</p>
          <Car className="w-4 h-4 text-cascade-500" />
        </div>
        <div className="bg-white border border-border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Avg rating</p>
          <p className="text-2xl font-bold text-cascade-900">
            {avgRating > 0 ? avgRating.toFixed(2) : "—"}
          </p>
          <Star className="w-4 h-4 text-summit-500" />
        </div>
        <div className="bg-white border border-border rounded-xl p-4 space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total vehicles</p>
          <p className="text-2xl font-bold text-cascade-900">{vehicles?.length ?? 0}</p>
          <Clock className="w-4 h-4 text-cascade-300" />
        </div>
      </div>

      {/* Per-vehicle table */}
      {vehicles && vehicles.length > 0 ? (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-cascade-900">Vehicle</th>
                <th className="text-right px-4 py-3 font-medium text-cascade-900">Trips</th>
                <th className="text-right px-4 py-3 font-medium text-cascade-900">Rating</th>
                <th className="text-right px-4 py-3 font-medium text-cascade-900">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-cascade-900">
                    {v.year} {v.make} {v.model}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{v.trip_count}</td>
                  <td className="px-4 py-3 text-right">
                    {v.rating_avg ? (
                      <span className="flex items-center justify-end gap-1">
                        <Star className="w-3 h-3 fill-summit-500 text-summit-500" />
                        {v.rating_avg.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        v.status === "listed"
                          ? "bg-alpine-500/10 text-alpine-500"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No vehicles listed yet.
        </div>
      )}
    </div>
  );
}
