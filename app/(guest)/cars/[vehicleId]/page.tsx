import { notFound } from "next/navigation";
import { Star, Users, Fuel, Gauge, Settings2, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PhotoGallery } from "@/components/vehicle/PhotoGallery";
import { BookingSidebar } from "@/components/vehicle/BookingSidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";
import type { VehicleWithDetails } from "@/types";

export const instant = false;

interface PageProps {
  params: Promise<{ vehicleId: string }>;
  searchParams: Promise<{ from?: string; until?: string }>;
}

const FEATURE_CATEGORY_ORDER = ["safety", "connectivity", "comfort", "convenience"];

export async function generateMetadata({ params }: PageProps) {
  const { vehicleId } = await params;
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("vehicles")
    .select("make, model, year")
    .eq("id", vehicleId)
    .single();

  if (!v) return { title: "Car not found" };
  return { title: `${v.year} ${v.make} ${v.model}` };
}

export default async function CarDetailPage({ params, searchParams }: PageProps) {
  const { vehicleId } = await params;
  const { from, until } = await searchParams;

  const supabase = await createClient();

  const [{ data: vehicle }, { data: { user } }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("*, vehicle_images(*), vehicle_features(*), profiles(id, full_name, avatar_url, host_since)")
      .eq("id", vehicleId)
      .neq("status", "suspended")
      .single(),
    supabase.auth.getUser(),
  ]);

  if (!vehicle) notFound();

  const v = vehicle as unknown as VehicleWithDetails & {
    profiles: { id: string; full_name: string; avatar_url: string | null; host_since: string | null };
  };

  // Group features by category
  const featuresByCategory = v.vehicle_features?.reduce<Record<string, string[]>>(
    (acc, f) => {
      if (!acc[f.category]) acc[f.category] = [];
      acc[f.category].push(f.feature);
      return acc;
    },
    {}
  ) ?? {};

  // Fetch reviews
  const { data: reviewsRaw } = await supabase
    .from("reviews")
    .select("*, profiles!reviewer_id(full_name, avatar_url)")
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: false })
    .limit(10);
  const reviews = reviewsRaw as Array<{
    id: string;
    created_at: string;
    rating_overall: number;
    body: string | null;
    profiles: { full_name: string; avatar_url: string | null } | null;
  }> | null;

  const fuelLabel: Record<string, string> = {
    gasoline: "Gas",
    hybrid: "Hybrid",
    electric: "Electric",
    diesel: "Diesel",
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Unlisted notice */}
      {v.status !== "listed" && (
        <div className="mb-4 rounded-lg bg-summit-500/10 border border-summit-500/30 px-4 py-3 text-sm text-summit-500 font-medium">
          This listing is currently unlisted and not visible in search results.
        </div>
      )}

      {/* Photo gallery */}
      <PhotoGallery
        images={v.vehicle_images ?? []}
        vehicleName={`${v.year} ${v.make} ${v.model}`}
      />

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-cascade-900">
              {v.make} {v.model}
            </h1>
            <p className="text-muted-foreground mt-1">
              {v.year} {v.trim && `· ${v.trim}`}
            </p>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {v.rating_avg && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-summit-500 text-summit-500" />
                  <span className="font-semibold text-cascade-900">
                    {v.rating_avg.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    ({v.trip_count} trips)
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" />
                {v.location_name}
              </div>
            </div>

            {/* Specs chips */}
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge variant="secondary" className="gap-1.5">
                <Users className="w-3 h-3" /> {v.seats} seats
              </Badge>
              <Badge variant="secondary" className="gap-1.5">
                <Fuel className="w-3 h-3" /> {fuelLabel[v.fuel_type] ?? v.fuel_type}
              </Badge>
              {v.mpg && (
                <Badge variant="secondary" className="gap-1.5">
                  <Gauge className="w-3 h-3" /> {v.mpg} MPG
                </Badge>
              )}
              {v.range_miles && (
                <Badge variant="secondary" className="gap-1.5">
                  <Gauge className="w-3 h-3" /> {v.range_miles} mi range
                </Badge>
              )}
              <Badge variant="secondary" className="gap-1.5">
                <Settings2 className="w-3 h-3" />{" "}
                {v.transmission === "automatic" ? "Automatic" : "Manual"}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Host info */}
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12">
              <AvatarImage src={v.profiles?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-cascade-100 text-cascade-700 font-semibold">
                {v.profiles?.full_name?.[0]?.toUpperCase() ?? "H"}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-cascade-900">{v.profiles?.full_name}</p>
              <p className="text-sm text-muted-foreground">
                {v.profiles?.host_since
                  ? `Hosting since ${formatDate(v.profiles.host_since, { year: "numeric", month: "long" })}`
                  : "Host"}
              </p>
            </div>
          </div>

          <Separator />

          {/* Description */}
          {v.description && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-cascade-900 mb-3">
                  About this car
                </h2>
                <p className="text-muted-foreground leading-relaxed">{v.description}</p>
              </div>
              <Separator />
            </>
          )}

          {/* Features */}
          {Object.keys(featuresByCategory).length > 0 && (
            <>
              <div>
                <h2 className="text-lg font-semibold text-cascade-900 mb-4">
                  Vehicle features
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {FEATURE_CATEGORY_ORDER.filter((cat) => featuresByCategory[cat]).map(
                    (category) => (
                      <div key={category}>
                        <h3 className="text-sm font-semibold capitalize text-cascade-700 mb-2">
                          {category}
                        </h3>
                        <ul className="space-y-1.5">
                          {featuresByCategory[category].map((feature) => (
                            <li
                              key={feature}
                              className="text-sm text-muted-foreground flex items-center gap-2"
                            >
                              <span className="w-1 h-1 rounded-full bg-cascade-500 shrink-0" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Included */}
          <div>
            <h2 className="text-lg font-semibold text-cascade-900 mb-4">
              Included in the price
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Skip the rental counter", desc: "Use the app for pickup and return." },
                { label: "Add additional drivers for free", desc: "Up to 2 additional drivers." },
                { label: "30-minute return grace period", desc: "No need to extend unless 30+ min late." },
                { label: "24/7 roadside assistance", desc: "Help is always available." },
              ].map(({ label, desc }) => (
                <div key={label} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-cascade-500 mt-2 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-cascade-900">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Reviews */}
          <div>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-lg font-semibold text-cascade-900">Reviews</h2>
              {v.rating_avg && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 fill-summit-500 text-summit-500" />
                  <span className="font-semibold">{v.rating_avg.toFixed(2)}</span>
                  <span className="text-muted-foreground text-sm">
                    · {v.trip_count} ratings
                  </span>
                </div>
              )}
            </div>

            {reviews?.length ? (
              <div className="space-y-6">
                {reviews.map((review) => (
                  <div key={review.id} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={(review as any).profiles?.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs bg-cascade-100 text-cascade-700">
                          {(review as any).profiles?.full_name?.[0]?.toUpperCase() ?? "G"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-cascade-900">
                          {(review as any).profiles?.full_name ?? "Guest"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(review.created_at)}
                        </p>
                      </div>
                      <div className="ml-auto flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3 h-3 ${i < review.rating_overall ? "fill-summit-500 text-summit-500" : "text-border"}`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.body && (
                      <p className="text-sm text-muted-foreground pl-11">{review.body}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No reviews yet.</p>
            )}
          </div>
        </div>

        {/* Right: Booking sidebar */}
        <div className="lg:col-span-1">
          <BookingSidebar
            vehicle={v}
            initialFrom={from}
            initialUntil={until}
            isLoggedIn={!!user}
          />
        </div>
      </div>
    </div>
  );
}
