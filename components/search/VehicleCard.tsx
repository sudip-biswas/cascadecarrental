import Link from "next/link";
import Image from "next/image";
import { Star, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { VehicleWithImages } from "@/types";

interface Props {
  vehicle: VehicleWithImages & {
    host?: { full_name: string } | null;
  };
  searchParams?: { from?: string; until?: string };
}

export function VehicleCard({ vehicle, searchParams }: Props) {
  const coverImage =
    vehicle.vehicle_images?.find((img) => img.is_cover)?.url ??
    vehicle.vehicle_images?.[0]?.url;

  const params = new URLSearchParams();
  if (searchParams?.from) params.set("from", searchParams.from);
  if (searchParams?.until) params.set("until", searchParams.until);
  const href = `/cars/${vehicle.id}?${params.toString()}`;

  const dailyRate = formatCurrency(vehicle.daily_rate_cents);

  return (
    <Link href={href} className="group block">
      <div className="relative rounded-xl overflow-hidden aspect-[4/3] bg-muted mb-3">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 bg-cascade-100 flex items-center justify-center">
            <span className="text-cascade-300 text-4xl">🚗</span>
          </div>
        )}

        {vehicle.rating_avg && vehicle.trip_count >= 3 && (
          <div className="absolute top-3 left-3">
            <Badge className="bg-alpine-500 text-white border-0 text-xs font-semibold">
              Great deal
            </Badge>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-cascade-900 leading-tight text-sm line-clamp-1">
            {vehicle.make} {vehicle.model}
          </h3>
          {vehicle.rating_avg && (
            <div className="flex items-center gap-1 shrink-0 text-sm">
              <Star className="w-3.5 h-3.5 fill-summit-500 text-summit-500" />
              <span className="font-medium text-cascade-900">
                {vehicle.rating_avg.toFixed(2)}
              </span>
              <span className="text-muted-foreground">
                ({vehicle.trip_count})
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {vehicle.year} · {vehicle.trim ?? vehicle.vehicle_type}
        </p>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="line-clamp-1">{vehicle.location_name}</span>
        </div>

        <p className="text-sm font-semibold text-cascade-900 pt-1">
          {dailyRate}{" "}
          <span className="font-normal text-muted-foreground">total</span>
        </p>
      </div>
    </Link>
  );
}
