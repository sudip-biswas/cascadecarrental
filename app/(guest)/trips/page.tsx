import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Calendar } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { Trip, Vehicle, VehicleImage } from "@/types";

export const instant = false;

export const metadata = { title: "My trips" };

type TripWithVehicle = Trip & {
  vehicles: Vehicle & { vehicle_images: VehicleImage[] };
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  active: "Active",
  completed: "Completed",
  cancelled_guest: "Cancelled",
  cancelled_host: "Cancelled by host",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-summit-500/10 text-summit-500 border-summit-500/30",
  approved: "bg-cascade-500/10 text-cascade-700 border-cascade-300",
  active: "bg-alpine-500/10 text-alpine-500 border-alpine-500/30",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled_guest: "bg-ember-500/10 text-ember-500 border-ember-500/30",
  cancelled_host: "bg-ember-500/10 text-ember-500 border-ember-500/30",
};

function TripCard({ trip }: { trip: TripWithVehicle }) {
  const cover =
    trip.vehicles?.vehicle_images?.find((i) => i.is_cover)?.url ??
    trip.vehicles?.vehicle_images?.[0]?.url;

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="flex gap-4 border border-border rounded-xl p-4 hover:shadow-md transition-shadow bg-white"
    >
      <div className="relative w-24 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
        {cover ? (
          <Image src={cover} alt="Vehicle" fill className="object-cover" sizes="96px" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-2xl">🚗</div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-cascade-900 text-sm line-clamp-1">
            {trip.vehicles?.make} {trip.vehicles?.model}
          </h3>
          <Badge
            className={`text-xs border shrink-0 ${STATUS_COLORS[trip.status]}`}
            variant="outline"
          >
            {STATUS_LABELS[trip.status] ?? trip.status}
          </Badge>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          {formatDate(trip.starts_at, { month: "short", day: "numeric" })} –{" "}
          {formatDate(trip.ends_at, { month: "short", day: "numeric", year: "numeric" })}
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3" />
          <span className="line-clamp-1">{trip.pickup_location}</span>
        </div>

        <p className="text-xs font-semibold text-cascade-900">
          {formatCurrency(trip.total_cents)} total
        </p>
      </div>
    </Link>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 space-y-3">
      <div className="text-4xl">🚗</div>
      <p className="text-muted-foreground text-sm">{message}</p>
      <Button asChild size="sm" className="bg-cascade-700 hover:bg-cascade-900 text-white">
        <Link href="/search">Find a car</Link>
      </Button>
    </div>
  );
}

export default async function TripsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/trips");

  const now = new Date().toISOString();

  const { data: allTrips } = await supabase
    .from("trips")
    .select("*, vehicles(*, vehicle_images(*))")
    .eq("guest_id", user.id)
    .order("starts_at", { ascending: false });

  const trips = (allTrips ?? []) as TripWithVehicle[];

  const upcoming = trips.filter(
    (t) =>
      ["pending", "approved"].includes(t.status) ||
      (t.status === "active" && t.starts_at > now)
  );
  const active = trips.filter(
    (t) => t.status === "active" && t.starts_at <= now
  );
  const past = trips.filter((t) =>
    ["completed", "cancelled_guest", "cancelled_host"].includes(t.status)
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-cascade-900 mb-6">My trips</h1>

      <Tabs defaultValue="upcoming">
        <TabsList className="mb-6">
          <TabsTrigger value="upcoming">
            Upcoming{upcoming.length > 0 && ` (${upcoming.length})`}
          </TabsTrigger>
          <TabsTrigger value="active">
            Active{active.length > 0 && ` (${active.length})`}
          </TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-3">
          {upcoming.length > 0 ? (
            upcoming.map((trip) => <TripCard key={trip.id} trip={trip} />)
          ) : (
            <EmptyState message="No upcoming trips. Find your next adventure!" />
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-3">
          {active.length > 0 ? (
            active.map((trip) => <TripCard key={trip.id} trip={trip} />)
          ) : (
            <EmptyState message="No active trips right now." />
          )}
        </TabsContent>

        <TabsContent value="past" className="space-y-3">
          {past.length > 0 ? (
            past.map((trip) => <TripCard key={trip.id} trip={trip} />)
          ) : (
            <EmptyState message="Your past trips will appear here." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
