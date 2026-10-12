import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MapPin, Star, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { VehicleStatusToggle } from "@/components/host/VehicleStatusToggle";
import type { VehicleWithImages } from "@/types";

export const instant = false;

export default async function HostVehicleDetailPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  const { vehicleId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("*, vehicle_images(*), vehicle_features(*)")
    .eq("id", vehicleId)
    .eq("host_id", user.id)
    .single();

  if (!vehicle) notFound();

  const v = vehicle as any;
  const images = v.vehicle_images ?? [];
  const cover = images.find((i: any) => i.is_cover)?.url ?? images[0]?.url;

  // Recent trips for this vehicle
  const { data: recentTrips } = await supabase
    .from("trips")
    .select("id, starts_at, ends_at, total_cents, status, guest:profiles!guest_id(full_name)")
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/host/vehicles"
            className="text-sm text-cascade-700 font-medium hover:underline"
          >
            ← My listings
          </Link>
          <h1 className="text-xl font-bold text-cascade-900 mt-1">
            {v.year} {v.make} {v.model}
          </h1>
          {v.trim && (
            <p className="text-sm text-muted-foreground">{v.trim}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`border ${
              v.status === "listed"
                ? "bg-alpine-500/10 text-alpine-500 border-alpine-500/30"
                : "bg-ember-500/10 text-ember-500 border-ember-500/30"
            }`}
          >
            {v.status === "listed" ? "Listed" : "Unlisted"}
          </Badge>
          <VehicleStatusToggle vehicleId={vehicleId} currentStatus={v.status} />
        </div>
      </div>

      {/* Photos */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 rounded-xl overflow-hidden">
          {images.slice(0, 3).map((img: any, i: number) => (
            <div key={img.id} className={`relative ${i === 0 ? "col-span-2 row-span-2" : ""} aspect-[4/3]`}>
              <Image
                src={img.url}
                alt={`Photo ${i + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 33vw"
              />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Specs */}
          <div className="bg-white border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-cascade-900">Vehicle details</h2>
            <div className="grid grid-cols-2 gap-y-3 text-sm">
              {[
                ["Type", v.vehicle_type],
                ["Fuel", v.fuel_type],
                ["Transmission", v.transmission],
                ["Seats", v.seats],
                ["Color", v.color],
                ["License plate", v.license_plate],
                v.mpg && ["MPG", v.mpg],
                v.range_miles && ["Range (mi)", v.range_miles],
              ]
                .filter(Boolean)
                .map(([label, value]) => (
                  <div key={label as string}>
                    <span className="text-muted-foreground">{label}</span>
                    <p className="font-medium text-cascade-900 capitalize">{value as string}</p>
                  </div>
                ))}
            </div>

            {v.description && (
              <>
                <Separator />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {v.description}
                </p>
              </>
            )}
          </div>

          {/* Location */}
          <div className="bg-white border border-border rounded-xl p-5 space-y-2">
            <h2 className="font-semibold text-cascade-900">Location</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 text-cascade-500 shrink-0" />
              <span>{v.location_name}</span>
            </div>
          </div>

          {/* Recent trips */}
          {recentTrips && recentTrips.length > 0 && (
            <div className="bg-white border border-border rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-cascade-900">Recent trips</h2>
              <div className="space-y-2">
                {recentTrips.map((trip: any) => (
                  <div
                    key={trip.id}
                    className="flex items-center justify-between text-sm py-2 border-b border-border/50 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-cascade-900">
                        {(trip.guest as any)?.full_name ?? "Guest"}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {new Date(trip.starts_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          –{" "}
                          {new Date(trip.ends_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                    <span className="font-semibold text-cascade-900">
                      {formatCurrency(trip.total_cents)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Pricing + Stats */}
        <div className="space-y-4">
          <div className="bg-white border border-border rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-cascade-900">Pricing</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Daily rate</span>
                <span className="font-semibold">
                  {formatCurrency(v.daily_rate_cents)}
                </span>
              </div>
              {v.weekly_discount_pct > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weekly discount</span>
                  <span>{v.weekly_discount_pct}%</span>
                </div>
              )}
              {v.monthly_discount_pct > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monthly discount</span>
                  <span>{v.monthly_discount_pct}%</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Included miles/day</span>
                <span>{v.distance_included_mi ?? "Unlimited"}</span>
              </div>
              {v.extra_mile_fee_cents > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Extra mile fee</span>
                  <span>{formatCurrency(v.extra_mile_fee_cents)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-cascade-700">
                <span className="text-muted-foreground">Your earnings/day</span>
                <span className="font-semibold">
                  {formatCurrency(Math.round(v.daily_rate_cents * 0.8))}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-border rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-cascade-900">Stats</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total trips</span>
                <span className="font-semibold">{v.trip_count ?? 0}</span>
              </div>
              {v.rating_avg ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Rating</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-summit-500 text-summit-500" />
                    <span className="font-semibold">
                      {(v.rating_avg as number).toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-xs">No ratings yet</p>
              )}
            </div>
          </div>

          <div className="bg-white border border-border rounded-xl p-5 space-y-2">
            <h2 className="font-semibold text-cascade-900">Trip settings</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Min trip</span>
                <span>{v.min_trip_days ?? 1} day{(v.min_trip_days ?? 1) !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max trip</span>
                <span>{v.max_trip_days ? `${v.max_trip_days} days` : "No limit"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Advance notice</span>
                <span>{v.advance_notice_hours ?? 0}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Instant book</span>
                <span>{v.instant_book ? "On" : "Off"}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
