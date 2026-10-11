import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Star, Calendar } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { Vehicle, VehicleImage } from "@/types";

export const instant = false;

export const metadata = { title: "My listings" };

type VehicleWithImages = Vehicle & { vehicle_images: VehicleImage[] };

function ListingCard({ vehicle }: { vehicle: VehicleWithImages }) {
  const cover =
    vehicle.vehicle_images?.find((i) => i.is_cover)?.url ??
    vehicle.vehicle_images?.[0]?.url;

  const isListed = vehicle.status === "listed";

  return (
    <Link href={`/host/vehicles/${vehicle.id}`} className="group block">
      <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-muted">
        {cover ? (
          <Image
            src={cover}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl">
            🚗
          </div>
        )}

        {/* Status ribbon */}
        <div
          className={`absolute top-0 left-0 px-3 py-1 text-xs font-bold text-white ${
            isListed ? "bg-alpine-500" : "bg-ember-500"
          }`}
        >
          {isListed ? "Listed" : "Unlisted"}
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <h3 className="font-semibold text-cascade-900 text-sm">
          {vehicle.make} {vehicle.model} {vehicle.year}
        </h3>
        <p className="text-xs text-muted-foreground">
          {vehicle.trim ?? vehicle.vehicle_type}
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {vehicle.rating_avg ? (
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-summit-500 text-summit-500" />
              <span>{vehicle.rating_avg.toFixed(2)}</span>
              <span>({vehicle.trip_count} trips)</span>
            </div>
          ) : (
            <span>No trips yet</span>
          )}
          <span className="font-semibold text-cascade-900">
            {formatCurrency(vehicle.daily_rate_cents)}/day
          </span>
        </div>
      </div>
    </Link>
  );
}

export default async function HostVehiclesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*, vehicle_images(*)")
    .eq("host_id", user.id)
    .order("created_at", { ascending: false });

  const v = (vehicles ?? []) as VehicleWithImages[];

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-cascade-900">
            {v.length} Listing{v.length !== 1 ? "s" : ""}
          </h1>
          {v.length > 0 && (
            <div className="flex items-center gap-2">
              <button className="text-sm text-muted-foreground border border-border rounded-full px-3 py-1">
                Trip status ▾
              </button>
              <button className="text-sm text-muted-foreground border border-border rounded-full px-3 py-1">
                Listing status ▾
              </button>
            </div>
          )}
        </div>

        <Button
          asChild
          className="bg-cascade-700 hover:bg-cascade-900 text-white gap-2"
        >
          <Link href="/host/vehicles/new">
            <Plus className="w-4 h-4" />
            List your car
          </Link>
        </Button>
      </div>

      {v.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="text-5xl">🚗</div>
          <h2 className="text-lg font-semibold text-cascade-900">
            No listings yet
          </h2>
          <p className="text-muted-foreground text-sm">
            List your first car to start earning on Cascade.
          </p>
          <Button
            asChild
            className="bg-cascade-700 hover:bg-cascade-900 text-white"
          >
            <Link href="/host/vehicles/new">
              <Plus className="w-4 h-4 mr-2" />
              List your car
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {v.map((vehicle) => (
            <ListingCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </div>
      )}
    </div>
  );
}
