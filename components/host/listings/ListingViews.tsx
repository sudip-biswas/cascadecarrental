import Link from "next/link";
import { Star } from "lucide-react";
import { carPath } from "@/lib/site";
import { cn, formatPrice, pluralize } from "@/lib/utils";
import { Fact, Tag } from "@/components/kit";
import { CarPhoto, coverUrl, STATUS_DOT } from "@/components/host/bits";
import { ListingActions } from "./ListingActions";
import { lastTrip, tripLine, trimAndPlate, type Listing } from "./query";

const nameOf = (car: Listing) => `${car.make} ${car.model}`;

/** "4.20 ★ (29 trips)", or how many trips when nobody has rated it yet. */
function Rating({ car, className }: { car: Listing; className?: string }) {
  return (
    <span className={cn("figures flex items-center gap-1 text-[15px] font-bold whitespace-nowrap", className)}>
      {car.rating_avg ? (
        <>
          {Number(car.rating_avg).toFixed(2)}
          <Star className="size-4 fill-ink" strokeWidth={0} aria-label="stars" />
          <span className="font-medium text-slate">({pluralize(car.trip_count, "trip")})</span>
        </>
      ) : car.trip_count ? (
        <span className="font-medium text-slate">{pluralize(car.trip_count, "trip")}, no ratings yet</span>
      ) : (
        <Tag tone="mint">New</Tag>
      )}
    </span>
  );
}

function StatusBadge({ status, className }: { status: Listing["status"]; className?: string }) {
  const s = STATUS_DOT[status];
  return (
    <span className={cn("flex w-fit items-center gap-1.5 rounded-[10px] bg-white px-2.5 py-1.5 text-[13px] font-bold", className)}>
      <span className={cn("size-2 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function ListingGrid({ cars }: { cars: Listing[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
      {cars.map((car) => {
        const name = nameOf(car);
        const href = `/host/vehicles/${car.id}`;
        const trip = tripLine(car);
        return (
          <article key={car.id} className="relative flex flex-col gap-4 rounded-[30px] bg-white px-3 pt-3 pb-5">
            <Link href={href} className="relative block rounded-[22px] transition-opacity hover:opacity-90">
              <CarPhoto
                src={coverUrl(car.vehicle_images)}
                alt={name}
                sizes="(max-width: 768px) 100vw, 420px"
                className="aspect-[16/10] w-full rounded-[22px]"
              />
              <StatusBadge status={car.status} className="absolute top-3 left-3" />
            </Link>
            <ListingActions vehicleId={car.id} name={name} previewHref={carPath(car)} className="absolute top-6 right-6" />
            <div className="flex flex-col gap-3 px-2">
              <div className="flex flex-col gap-1">
                <Link
                  href={href}
                  className="truncate font-display text-[26px] font-extrabold tracking-[-0.02em] hover:underline sm:text-[28px]"
                >
                  {name} {car.year}
                </Link>
                <span className="truncate text-[15px] text-slate">{trimAndPlate(car)}</span>
                <span className="flex items-center justify-between gap-3 text-[14px] text-slate">
                  <span className="truncate">{lastTrip(car)}</span>
                  <Rating car={car} className="shrink-0 text-[14px]" />
                </span>
              </div>
              <div className="figures grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
                <Fact label="Price" value={`${formatPrice(car.daily_rate_cents)}/day`} className="rounded-[16px] p-3" />
                <Fact label={trip.label} value={trip.value} tone={trip.tone} className="rounded-[16px] p-3" />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

const ROW = "md:grid md:grid-cols-[minmax(0,2.2fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_minmax(0,1.3fr)_40px] md:items-center md:gap-4";

export function ListingList({ cars }: { cars: Listing[] }) {
  return (
    <div className="flex flex-col gap-2">
      <div className={cn(ROW, "hidden px-4 text-[13px] font-bold text-slate md:grid")}>
        <span>Car</span>
        <span>Listing</span>
        <span>Trip status</span>
        <span>Reviews</span>
        <span />
      </div>
      <ul className="flex flex-col gap-2">
        {cars.map((car) => {
          const name = nameOf(car);
          const trip = tripLine(car);
          return (
            <li
              key={car.id}
              className={cn(ROW, "relative flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[24px] bg-white p-3 pr-4")}
            >
              <Link href={`/host/vehicles/${car.id}`} className="group flex min-w-0 flex-[1_1_100%] items-center gap-4 md:flex-none">
                <CarPhoto
                  src={coverUrl(car.vehicle_images)}
                  alt={name}
                  sizes="112px"
                  className="h-[72px] w-24 shrink-0 rounded-[16px] sm:h-[84px] sm:w-28"
                />
                <span className="flex min-w-0 flex-col gap-0.5 pr-12 md:pr-0">
                  <span className="truncate text-[18px] font-extrabold group-hover:underline">
                    {name} {car.year}
                  </span>
                  <span className="truncate text-[15px] text-slate">{trimAndPlate(car)}</span>
                </span>
              </Link>
              <StatusBadge status={car.status} className="bg-board" />
              <span className="order-last flex basis-full flex-col text-[15px] md:order-none md:basis-auto">
                <span>
                  <span className="font-semibold">{trip.label}:</span> {trip.value}
                </span>
                <span className="text-[14px] text-slate">{lastTrip(car)}</span>
              </span>
              <Rating car={car} />
              <ListingActions
                vehicleId={car.id}
                name={name}
                previewHref={carPath(car)}
                className="absolute top-3 right-3 bg-board hover:bg-line md:static"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
