import Image from "next/image";
import Link from "next/link";
import { CarFront, Star } from "lucide-react";
import { Tag } from "@/components/kit";
import { FavoriteButton } from "@/components/vehicle/FavoriteButton";
import { cn, formatPrice } from "@/lib/utils";
import { fuelLabel } from "./categories";
import {
  carHref,
  coverImage,
  firstName,
  formatMiles,
  offersUnlimitedMiles,
  roughPrice,
  tripPrice,
  type ListedVehicle,
} from "./vehicle";
import type { DateKey } from "./dates";

interface Props {
  vehicle: ListedVehicle;
  dates?: { from: DateKey; until: DateKey } | null;
  /** tile: photo on top. row: photo beside the details. compact: small phone row. */
  layout?: "tile" | "row" | "compact";
  priority?: boolean;
  /** Shows the heart. Leave out where saving makes no sense. */
  favorite?: { userId: string | null; saved: boolean };
  /** Miles from the place the guest searched. */
  distanceMi?: number | null;
}

function Photo({ vehicle, className, sizes, priority }: { vehicle: ListedVehicle; className?: string; sizes: string; priority?: boolean }) {
  const cover = coverImage(vehicle.vehicle_images);
  return (
    <span className={cn("relative block overflow-hidden bg-line", className)}>
      {cover ? (
        <Image
          src={cover.url}
          alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-quiet">
          <CarFront className="size-10" strokeWidth={1.5} />
        </span>
      )}
    </span>
  );
}

function Rating({ vehicle }: { vehicle: ListedVehicle }) {
  if (!vehicle.rating_avg) return null;
  return (
    <span className="flex items-center gap-1 text-sm font-bold">
      <Star className="size-4 fill-ink" strokeWidth={0} />
      {vehicle.rating_avg.toFixed(1)}
      <span className="font-medium text-slate">({vehicle.trip_count})</span>
    </span>
  );
}

/** The heart sits over the photo, beside the link rather than inside it. */
const HEART_SPOT = {
  tile: "top-5 right-5",
  row: "top-5 left-5",
  compact: "top-3 left-3",
} as const;

export function VehicleCard({ favorite, ...props }: Props) {
  if (!favorite) return <Card {...props} />;
  const layout = props.layout ?? "tile";
  return (
    <div className="relative">
      <Card {...props} heart />
      <FavoriteButton
        vehicleId={props.vehicle.id}
        userId={favorite.userId}
        saved={favorite.saved}
        size={layout === "compact" ? "sm" : "md"}
        className={`absolute ${HEART_SPOT[layout]}`}
      />
    </div>
  );
}

/** The pre-discount total struck through, when a trip-length discount applies. */
function WasPrice({ cents, className }: { cents: number | null; className?: string }) {
  if (cents === null) return null;
  return (
    <s className={cn("font-sans font-semibold text-quiet", className)}>
      <span className="sr-only">Was </span>
      {roughPrice(cents)}
    </s>
  );
}

function Card({ vehicle, dates, layout = "tile", priority, heart, distanceMi }: Omit<Props, "favorite"> & { heart?: boolean }) {
  const href = carHref(vehicle, dates);
  const name = `${vehicle.make} ${vehicle.model}`;
  const price = dates ? tripPrice(vehicle, dates.from, dates.until) : null;
  const perDay = price?.dailyCents ?? vehicle.price_today_cents ?? vehicle.daily_rate_cents;
  const total = price?.totalCents ?? null;
  const isNew = vehicle.trip_count === 0;
  const unlimited = offersUnlimitedMiles(vehicle);
  const host = firstName(vehicle.persona?.name ?? vehicle.host?.full_name);
  const place = distanceMi != null ? `${vehicle.location_name} · ${formatMiles(distanceMi)}` : vehicle.location_name;

  if (layout === "compact") {
    return (
      <Link href={href} className="flex items-center gap-3 rounded-[24px] bg-white p-2 transition-colors hover:bg-white/70">
        <Photo vehicle={vehicle} className="h-[88px] w-28 shrink-0 rounded-[17px]" sizes="112px" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[17px] font-extrabold">{name}</span>
          <span className="truncate text-sm text-slate">
            {vehicle.year} · {isNew ? "New listing" : `${vehicle.seats} seats`} · {place}
          </span>
          <span className="figures text-[17px] font-extrabold">
            {formatPrice(perDay)}{" "}
            <span className="text-[13px] font-semibold text-slate">
              /day
              {total !== null && (
                <>
                  {" · "}
                  <WasPrice cents={price?.beforeDiscountCents ?? null} /> {roughPrice(total)} total
                </>
              )}
            </span>
          </span>
        </span>
      </Link>
    );
  }

  if (layout === "row") {
    return (
      <Link
        href={href}
        className="flex flex-col gap-4 rounded-[26px] bg-white p-2.5 transition-colors hover:bg-white/70 sm:flex-row"
      >
        <Photo
          vehicle={vehicle}
          priority={priority}
          className="aspect-[4/3] w-full shrink-0 rounded-[18px] sm:w-[240px]"
          sizes="(max-width: 640px) 100vw, 240px"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-2 px-2 pb-2 sm:py-2 sm:pl-0">
          <span className="flex items-start justify-between gap-2">
            <span className="font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.025em]">{name}</span>
            {isNew ? <Tag tone="mint">New listing</Tag> : <Rating vehicle={vehicle} />}
          </span>
          <span className="text-[15px] text-slate">
            {[`${vehicle.year}${vehicle.trim ? ` ${vehicle.trim}` : ""}`, host, place]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span className="flex flex-wrap gap-1.5">
            <Tag className="font-semibold">{vehicle.seats} seats</Tag>
            <Tag className="font-semibold">{fuelLabel(vehicle.fuel_type)}</Tag>
            <Tag className="font-semibold capitalize">{vehicle.transmission}</Tag>
            <Tag className="font-semibold">{vehicle.distance_included_mi} mi/day</Tag>
            {unlimited && <Tag tone="lilac">Unlimited miles add-on</Tag>}
            {vehicle.instant_book && <Tag tone="sky">Instant book</Tag>}
          </span>
          <span className="figures mt-auto flex items-baseline justify-between gap-3 pt-1">
            <span className="text-[15px] text-slate">{formatPrice(perDay)} a day</span>
            {total !== null ? (
              <span className="flex flex-col items-end gap-1">
                <span className="font-display text-[28px] font-extrabold">
                  <WasPrice cents={price?.beforeDiscountCents ?? null} className="mr-1.5 text-[17px]" />
                  {roughPrice(total)}
                  <span className="font-sans text-sm font-medium text-slate"> total</span>
                </span>
                {price?.beforeDiscountCents != null && price.discountLabel && (
                  <Tag tone="mint" className="mt-0.5">{price.discountLabel}</Tag>
                )}
              </span>
            ) : (
              <span className="text-sm text-slate">Add dates for a total</span>
            )}
          </span>
        </span>
      </Link>
    );
  }

  return (
    <Link href={href} className="flex flex-col gap-3.5 rounded-[28px] bg-white px-2.5 pt-2.5 pb-5 transition-colors hover:bg-white/70">
      <span className="relative block">
        <Photo
          vehicle={vehicle}
          priority={priority}
          className="aspect-[4/3] w-full rounded-[20px]"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px"
        />
        {isNew && <Tag tone="mint" className="absolute top-2.5 left-2.5">New listing</Tag>}
        {vehicle.instant_book && (
          <Tag tone="white" className={cn("absolute", heart ? "bottom-2.5 left-2.5" : "top-2.5 right-2.5")}>
            Instant book
          </Tag>
        )}
      </span>
      <span className="flex flex-col gap-1 px-2.5">
        <span className="flex items-start justify-between gap-2">
          <span className="font-display text-[23px] leading-tight font-extrabold tracking-[-0.02em]">{name}</span>
          <Rating vehicle={vehicle} />
        </span>
        <span className="text-[15px] text-slate">
          {vehicle.year} · {vehicle.seats} seats · {place}
        </span>
        <span className="figures flex items-baseline justify-between gap-2 pt-2">
          <span className="text-[22px] font-extrabold">
            {formatPrice(perDay)}
            <span className="text-sm font-medium text-slate"> /day</span>
          </span>
          {total !== null && (
            <span className="text-sm text-slate">
              <WasPrice cents={price?.beforeDiscountCents ?? null} /> {roughPrice(total)} for your dates
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
