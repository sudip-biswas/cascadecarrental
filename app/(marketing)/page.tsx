import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, KeyRound, Route, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { HOST_SHARE } from "@/lib/pricing";
import { cn, formatPrice } from "@/lib/utils";
import { Container, toneClass } from "@/components/kit";
import { SearchForm } from "@/components/search/SearchForm";
import { VehicleCard } from "@/components/search/VehicleCard";
import { TRIP_CATEGORIES } from "@/components/search/categories";
import { LISTED_VEHICLE_SELECT, coverImage, firstName, type ListedVehicle } from "@/components/search/vehicle";

export const instant = false;

const STEPS = [
  { icon: CalendarDays, title: "Request", body: "Pick dates and pay. On request-to-book cars your card is only held until the host says yes." },
  { icon: Check, title: "Host says yes", body: "Instant-book cars skip this step." },
  { icon: KeyRound, title: "Get the keys", body: "Meet the host at the car and check it over together." },
  { icon: Route, title: "Drive", body: "Every car shows the miles included per day and what extra miles cost." },
  { icon: Undo2, title: "Bring it back", body: "Same spot, same fuel. Then leave a review." },
];

/** The example on the hosting pitch: a $50 car booked ten days a month. */
const EXAMPLE_RATE_CENTS = 5000;
const EXAMPLE_DAYS = 10;
const BOOKED_DAYS = new Set([0, 1, 5, 6, 7, 12, 13, 19, 20, 21]);

async function loadFeatured() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select(LISTED_VEHICLE_SELECT)
    .eq("status", "listed")
    .order("trip_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(3);
  return (data ?? []) as unknown as ListedVehicle[];
}

function HeroCar({ car }: { car: ListedVehicle }) {
  const cover = coverImage(car.vehicle_images);
  if (!cover) return null;
  const host = firstName(car.host?.full_name);
  return (
    <Link href={`/cars/${car.id}`} className="relative block min-w-0 flex-[1_1_380px]">
      <span className="relative block aspect-[1/0.86] overflow-hidden rounded-[32px]">
        <Image
          src={cover.url}
          alt={`${car.year} ${car.make} ${car.model} in ${car.location_name}`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 480px"
          className="object-cover"
        />
      </span>
      <span className="figures absolute top-4 left-4 rounded-[14px] bg-white px-3.5 py-2.5 font-display text-2xl font-extrabold">
        {formatPrice(car.daily_rate_cents)}
        <span className="font-sans text-sm font-medium text-slate"> a day</span>
      </span>
      <span className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-[18px] bg-white px-3.5 py-3">
        <span aria-hidden className="flex size-[42px] shrink-0 items-center justify-center rounded-[12px] bg-mint font-display text-lg font-extrabold">
          {(host ?? car.make)[0].toUpperCase()}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-bold">
            {car.make} {car.model} {car.year}
          </span>
          <span className="truncate text-sm text-slate">
            {host ? `${host}'s car · ` : ""}
            {car.location_name}
          </span>
        </span>
        <ArrowRight className="size-5 shrink-0" strokeWidth={2} />
      </span>
    </Link>
  );
}

export default async function HomePage() {
  const featured = await loadFeatured();
  const hero = featured.find((car) => coverImage(car.vehicle_images));
  const exampleGross = EXAMPLE_RATE_CENTS * EXAMPLE_DAYS;

  return (
    <>
      <section className="bg-sky pt-8 pb-12 sm:pt-12 sm:pb-16">
        <Container className="flex flex-wrap items-center gap-8">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-7">
            <h1 className="headline text-[clamp(46px,7vw,112px)] leading-none text-ink">
              Borrow a car from someone nearby.
            </h1>
            <SearchForm />
          </div>
          {hero && <HeroCar car={hero} />}
        </Container>
      </section>

      <Container className="pt-12 sm:pt-14">
        <h2 className="headline mb-4 text-[28px] leading-[1.12] sm:mb-5 sm:text-[44px]">What&apos;s the trip?</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(250px,1fr))] sm:gap-4 sm:overflow-visible sm:px-0">
          {TRIP_CATEGORIES.map(({ key, title, blurb, icon: Icon, tone, params }) => (
            <Link
              key={key}
              href={`/search?${new URLSearchParams(params).toString()}`}
              className={cn(
                "flex w-[150px] shrink-0 flex-col justify-between gap-6 rounded-[22px] p-3.5 transition-[filter] hover:brightness-[0.97] sm:min-h-[230px] sm:w-auto sm:rounded-[28px] sm:p-6",
                toneClass[tone]
              )}
            >
              <span className="flex size-11 items-center justify-center rounded-[14px] bg-white text-ink sm:size-14 sm:rounded-[16px]">
                <Icon className="size-6 sm:size-7" strokeWidth={1.75} />
              </span>
              <span>
                <span className="block text-base leading-tight font-extrabold text-ink sm:mb-1.5 sm:font-display sm:text-[30px] sm:leading-[1.12] sm:tracking-[-0.03em]">
                  {title}
                </span>
                <span className="hidden text-base sm:block">{blurb}</span>
              </span>
            </Link>
          ))}
        </div>
      </Container>

      <Container className="pt-12 sm:pt-16">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4 sm:mb-5">
          <h2 className="headline text-[28px] leading-[1.12] sm:text-[44px]">Near Seattle</h2>
          <Link
            href="/search"
            className="flex items-center gap-1.5 rounded-[12px] bg-white px-4 py-3 text-base font-bold transition-colors hover:bg-line"
          >
            See all cars
            <ArrowRight className="size-[18px]" strokeWidth={2} />
          </Link>
        </div>
        <div className="flex flex-col gap-2 sm:hidden">
          {featured.map((car) => (
            <VehicleCard key={car.id} vehicle={car} layout="compact" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(270px,1fr))]">
          {featured.map((car) => (
            <div key={car.id} className="hidden sm:block">
              <VehicleCard vehicle={car} />
            </div>
          ))}
          <Link
            href="/host/vehicles/new"
            className="flex min-h-[260px] flex-col justify-between gap-5 rounded-[28px] bg-ink p-6 text-white transition-colors hover:bg-graphite sm:min-h-[340px] sm:p-[26px]"
          >
            <svg width="72" height="72" viewBox="0 0 48 48" aria-hidden="true">
              <rect x="2" y="8" width="26" height="9" rx="4.5" fill="#CFE2FF" />
              <rect x="10" y="20" width="26" height="9" rx="4.5" fill="#C9EED6" />
              <rect x="18" y="32" width="26" height="9" rx="4.5" fill="#FFE7A0" />
            </svg>
            <span className="flex flex-col gap-3">
              <span className="font-display text-[30px] leading-[1.12] font-extrabold tracking-[-0.03em] sm:text-[34px]">
                Got a car that sits all week?
              </span>
              <span className="flex items-center gap-1.5 text-base font-semibold text-butter">
                List your car
                <ArrowRight className="size-[18px]" strokeWidth={2} />
              </span>
            </span>
          </Link>
        </div>
      </Container>

      <section className="mt-14 bg-butter py-12 sm:mt-[72px] sm:py-16">
        <Container className="flex flex-col gap-6 sm:gap-8">
          <h2 className="headline text-[clamp(40px,5.4vw,80px)] leading-none">How a trip works</h2>
          <ol className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(210px,1fr))]">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="flex flex-col gap-4 rounded-[24px] bg-white p-[22px]">
                <span className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-[50px] items-center justify-center rounded-[15px]",
                      i === 0 ? "bg-ink text-white" : "bg-board text-ink"
                    )}
                  >
                    <Icon className="size-6" strokeWidth={1.75} />
                  </span>
                  <span aria-hidden className="font-display text-[44px] leading-none font-extrabold text-butter">
                    {i + 1}
                  </span>
                </span>
                <span className="font-display text-[25px] font-extrabold">{title}</span>
                <span className="text-[15px] leading-[1.45] text-slate">{body}</span>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="bg-peach py-14 sm:py-[72px]">
        <Container className="flex flex-wrap items-center gap-10">
          <div className="flex min-w-0 flex-[999_1_460px] flex-col items-start gap-7">
            <h2 className="headline text-[clamp(44px,6vw,96px)] leading-none">Your car can earn while it&apos;s parked.</h2>
            <Link
              href="/host/vehicles/new"
              className="flex items-center gap-2.5 rounded-[16px] bg-ink px-[26px] py-[18px] text-lg font-bold text-white transition-colors hover:bg-graphite"
            >
              List your car
              <ArrowRight className="size-5" strokeWidth={2} />
            </Link>
          </div>
          <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-5 rounded-[32px] bg-white p-5 sm:p-7">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-[18px] bg-board px-4 py-3.5">
                <div className="text-[13px] font-semibold text-slate">Your price</div>
                <div className="font-display text-[30px] font-extrabold sm:text-[34px]">
                  {formatPrice(EXAMPLE_RATE_CENTS)}
                  <span className="font-sans text-[15px] font-medium text-slate"> /day</span>
                </div>
              </div>
              <div className="rounded-[18px] bg-board px-4 py-3.5">
                <div className="text-[13px] font-semibold text-slate">Days booked</div>
                <div className="font-display text-[30px] font-extrabold sm:text-[34px]">
                  {EXAMPLE_DAYS}
                  <span className="font-sans text-[15px] font-medium text-slate"> a month</span>
                </div>
              </div>
            </div>
            <div aria-hidden className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-[5px]">
              {Array.from({ length: 30 }, (_, day) => (
                <span key={day} className={cn("aspect-square rounded-[5px]", BOOKED_DAYS.has(day) ? "bg-ink" : "bg-line")} />
              ))}
            </div>
            <div className="figures flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-base text-slate">
                Example month: {formatPrice(exampleGross)} in bookings, less Cascade&apos;s{" "}
                {Math.round((1 - HOST_SHARE) * 100)}% fee
              </span>
              <span className="font-display text-[48px] leading-none font-extrabold tracking-[-0.03em] sm:text-[56px]">
                {formatPrice(Math.round(exampleGross * HOST_SHARE))}
              </span>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
