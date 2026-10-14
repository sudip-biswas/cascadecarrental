import Image from "next/image";
import type { ReactNode } from "react";
import { Check, CarFront } from "lucide-react";
import { Tile } from "@/components/kit";
import { cn, toDateKey, zonedInstant } from "@/lib/utils";
import { type TripRow, carName, coverOf } from "../_lib/trip-row";

export function CarPhoto({ trip, className, sizes }: { trip: TripRow; className?: string; sizes: string }) {
  const cover = coverOf(trip);
  return (
    <span className={cn("relative block shrink-0 overflow-hidden bg-line", className)}>
      {cover ? (
        <Image src={cover} alt={carName(trip)} fill sizes={sizes} className="object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-slate">
          <CarFront className="size-8" strokeWidth={1.5} />
        </span>
      )}
    </span>
  );
}

export function CarSummary({ trip, detail }: { trip: TripRow; detail: ReactNode }) {
  return (
    <Tile className="flex items-center gap-3.5 p-3 sm:p-3">
      <CarPhoto trip={trip} sizes="110px" className="h-[86px] w-[110px] rounded-[18px]" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-display text-[24px] leading-tight font-extrabold">{carName(trip)}</span>
        <span className="text-sm text-slate">{detail}</span>
      </span>
    </Tile>
  );
}

export interface Step {
  label: string;
  when?: string;
  done: boolean;
}

/** Vertical checklist of where a trip is. */
export function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {steps.map((s) => (
        <li key={s.label} className="flex items-start gap-3.5">
          <span
            className={cn(
              "flex size-[30px] shrink-0 items-center justify-center rounded-[10px]",
              s.done ? "bg-ink text-white" : "bg-white ring-2 ring-ink ring-inset"
            )}
          >
            {s.done && <Check className="size-4" strokeWidth={3} />}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[17px] font-bold">{s.label}</span>
            {s.when && <span className="text-sm text-slate">{s.when}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Whole days between two Pacific dates. */
export function daysBetween(a: Date | string, b: Date | string): number {
  return Math.round((zonedInstant(toDateKey(b)).getTime() - zonedInstant(toDateKey(a)).getTime()) / 86_400_000);
}

export function mapsUrl(trip: TripRow): string | null {
  const v = trip.vehicle;
  if (!v) return null;
  const destination = v.location_address || `${v.location_lat},${v.location_lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

function calendarStamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function calendarUrl(trip: TripRow): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${carName(trip)} from Cascade`,
    dates: `${calendarStamp(trip.starts_at)}/${calendarStamp(trip.ends_at)}`,
    location: trip.vehicle?.location_address || trip.pickup_location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
