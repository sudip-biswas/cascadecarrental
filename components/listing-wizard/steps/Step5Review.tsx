import Image from "next/image";
import { MapPin, Fuel, Users, Gauge, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import type { WizardData } from "../WizardShell";

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

export function Step5Review({ data }: Props) {
  const cover = data.images.find((img) => img.isCover) ?? data.images[0];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-cascade-900">Review your listing</h2>
      <p className="text-sm text-muted-foreground">
        Here&apos;s how your listing will appear to guests. You can always edit it after publishing.
      </p>

      {/* Cover photo */}
      {cover && (
        <div className="relative aspect-[16/9] rounded-xl overflow-hidden">
          <Image
            src={cover.url}
            alt="Cover"
            fill
            className="object-cover"
            sizes="600px"
          />
        </div>
      )}

      {/* Details */}
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-bold text-cascade-900">
            {data.make} {data.model}
          </h3>
          <p className="text-muted-foreground">
            {data.year} {data.trim && `· ${data.trim}`} · {data.color}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <Users className="w-3 h-3" /> {data.seats} seats
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            <Fuel className="w-3 h-3" /> {data.fuelType}
          </Badge>
          {data.mpg && (
            <Badge variant="secondary" className="gap-1.5">
              <Gauge className="w-3 h-3" /> {data.mpg} MPG
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="w-4 h-4 text-cascade-500 shrink-0" />
          {data.locationName || "Location not set"}
        </div>

        {data.description && (
          <p className="text-sm text-muted-foreground">{data.description}</p>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Daily rate</p>
            <p className="font-semibold text-cascade-900">
              {formatCurrency(data.dailyRateCents)}/day
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Distance included</p>
            <p className="font-semibold text-cascade-900">
              {data.distanceIncludedMi} mi/day
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Minimum trip</p>
            <p className="font-semibold text-cascade-900">
              {data.minTripDays} day{data.minTripDays > 1 ? "s" : ""}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Instant book</p>
            <p className="font-semibold text-cascade-900">
              {data.instantBook ? "Enabled" : "Disabled"}
            </p>
          </div>
        </div>

        <Separator />

        <div className="text-sm">
          <p className="text-muted-foreground">Photos</p>
          <p className="font-semibold text-cascade-900">
            {data.images.length} photo{data.images.length !== 1 ? "s" : ""} uploaded
          </p>
        </div>
      </div>

      {data.images.length < 3 && (
        <div className="bg-summit-500/10 border border-summit-500/30 rounded-lg px-4 py-3 text-sm text-summit-500">
          Please go back and add at least 3 photos before publishing.
        </div>
      )}
    </div>
  );
}
