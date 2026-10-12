import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency } from "@/lib/utils";
import { TripActionButtons } from "@/components/trips/TripActionButtons";

export const instant = false;

export const metadata = { title: "Host trips" };

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-summit-500/10 text-summit-500 border-summit-500/30",
  approved: "bg-cascade-500/10 text-cascade-700 border-cascade-300",
  active: "bg-alpine-500/10 text-alpine-500 border-alpine-500/30",
};

export default async function HostTripsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trips } = await supabase
    .from("trips")
    .select(
      "*, vehicles(make, model, year, vehicle_images(*)), guest:profiles!guest_id(id, full_name, avatar_url)"
    )
    .eq("host_id", user.id)
    .in("status", ["pending", "approved", "active"])
    .order("starts_at", { ascending: true });

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-cascade-900 mb-6">Booked trips</h1>

      {!trips?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No upcoming booked trips.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {trips.map((trip: any) => {
            const cover =
              trip.vehicles?.vehicle_images?.find((i: any) => i.is_cover)?.url ??
              trip.vehicles?.vehicle_images?.[0]?.url;

            return (
              <div
                key={trip.id}
                className="bg-white border border-border rounded-xl p-4 flex gap-4"
              >
                <div className="relative w-20 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                  {cover ? (
                    <Image src={cover} alt="Vehicle" fill className="object-cover" sizes="80px" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-2xl">🚗</div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-cascade-900 text-sm">
                        {trip.vehicles?.make} {trip.vehicles?.model}{" "}
                        {trip.vehicles?.year}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {formatDate(trip.starts_at, { month: "short", day: "numeric" })} –{" "}
                          {formatDate(trip.ends_at, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <Badge
                      className={`text-xs border ${STATUS_COLORS[trip.status]}`}
                      variant="outline"
                    >
                      {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={trip.guest?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px] bg-cascade-100 text-cascade-700">
                          {trip.guest?.full_name?.[0]?.toUpperCase() ?? "G"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        {trip.guest?.full_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-cascade-900">
                        {formatCurrency(trip.total_cents)}
                      </span>
                      <TripActionButtons tripId={trip.id} status={trip.status} />
                      <Button size="sm" variant="ghost" asChild className="h-7 px-2">
                        <Link href={`/host/inbox`}>
                          <MessageCircle className="w-3.5 h-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
