import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatCurrency } from "@/lib/utils";

export const instant = false;

export const metadata = { title: "Trip history" };

export default async function HostTripHistoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trips } = await supabase
    .from("trips")
    .select("*, vehicles(make, model, year, vehicle_images(*)), guest:profiles!guest_id(full_name)")
    .eq("host_id", user.id)
    .in("status", ["completed", "cancelled_guest", "cancelled_host"])
    .order("ends_at", { ascending: false })
    .limit(50);

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-cascade-900 mb-6">Trip history</h1>

      {!trips?.length ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No past trips yet.
        </div>
      ) : (
        <div className="space-y-3">
          {(trips as any[]).map((trip) => {
            const cover =
              trip.vehicles?.vehicle_images?.find((i: any) => i.is_cover)?.url ??
              trip.vehicles?.vehicle_images?.[0]?.url;

            return (
              <div
                key={trip.id}
                className="bg-white border border-border rounded-xl p-4 flex gap-4 items-center"
              >
                <div className="relative w-16 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                  {cover ? (
                    <Image src={cover} alt="Vehicle" fill className="object-cover" sizes="64px" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xl">🚗</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-cascade-900 text-sm">
                    {trip.vehicles?.make} {trip.vehicles?.model} {trip.vehicles?.year}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {trip.guest?.full_name} ·{" "}
                    {formatDate(trip.starts_at, { month: "short", day: "numeric" })} –{" "}
                    {formatDate(trip.ends_at, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold text-cascade-900">
                    {formatCurrency(Math.round(trip.total_cents * 0.8))}
                  </p>
                  <Badge
                    className={`text-xs ${
                      trip.status === "completed"
                        ? "bg-alpine-500/10 text-alpine-500"
                        : "bg-ember-500/10 text-ember-500"
                    }`}
                    variant="outline"
                  >
                    {trip.status === "completed" ? "Completed" : "Cancelled"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
