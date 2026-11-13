import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, KeyRound, MapPin, Phone, Route, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { RENTING_FAQ } from "@/lib/rentals";
import { OPEN_GRAPH, SITE_NAME, SITE_URL, absoluteUrl, carPath } from "@/lib/site";
import { cn, formatCurrency, formatPrice } from "@/lib/utils";
import { PROTECTION_DAILY_CENTS } from "@/lib/pricing";
import { Container, toneClass } from "@/components/kit";
import { Faq } from "@/components/seo/Faq";
import { JsonLd } from "@/components/seo/JsonLd";
import { SearchForm } from "@/components/search/SearchForm";
import { VehicleCard } from "@/components/search/VehicleCard";
import { withTodayPrices } from "@/components/search/prices";
import { TRIP_CATEGORIES } from "@/components/search/categories";
import { LISTED_VEHICLE_SELECT, coverImage, type ListedVehicle } from "@/components/search/vehicle";

export const instant = false;

export const metadata: Metadata = {
  title: "Cascade Car Rental — Sea-Tac Airport car rental from a local licensed fleet",
  description:
    "Book a car from Cascade Fleet LLC near Seattle-Tacoma International Airport. Total price includes tax. Instant book, flexible cancellation, protection from $11.99/day.",
  alternates: { canonical: "/" },
  openGraph: { ...OPEN_GRAPH, url: "/" },
};

const ORGANIZATION = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    legalName: "Cascade Fleet LLC",
    url: SITE_URL,
    logo: absoluteUrl("/logo.png"),
    description: "Licensed rental car company at Sea-Tac Airport. WA rental car registration #R64728.",
    telephone: "+16502724085",
    identifier: { "@type": "PropertyValue", propertyID: "WA Rental Car Registration", value: "R64728" },
    areaServed: { "@type": "City", name: "Seattle", containedInPlace: { "@type": "State", name: "Washington" } },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { "@id": `${SITE_URL}/#organization` },
  },
];

const STEPS = [
  {
    icon: CalendarDays,
    title: "Pick your car",
    body: "Choose your dates, select protection, and pay. Your car is booked the moment you confirm.",
  },
  {
    icon: KeyRound,
    title: "Get the details",
    body: "We send pickup instructions and the meeting-point address as soon as you book.",
  },
  {
    icon: MapPin,
    title: "Meet us at the car",
    body: "We're at the DoubleTree by Hilton SeaTac with your car and keys — no counter, no queue.",
  },
  {
    icon: Route,
    title: "Drive",
    body: "Every car shows the miles included per day and what extra miles cost.",
  },
  {
    icon: Undo2,
    title: "Return and review",
    body: "Back to the same spot. We log the photos together, then you leave a review.",
  },
];

const TRUST_ITEMS = [
  "WA-licensed fleet #R64728",
  "Total price includes tax",
  "Free cancellation on flexible rates",
  `Protection from ${formatCurrency(PROTECTION_DAILY_CENTS.basic)}/day`,
];

async function loadFeatured() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicles")
    .select(LISTED_VEHICLE_SELECT)
    .eq("status", "listed")
    .order("year", { ascending: false })
    .order("daily_rate_cents", { ascending: false })
    .limit(3);
  return withTodayPrices((data ?? []) as unknown as ListedVehicle[]);
}

function HeroCar({ car }: { car: ListedVehicle }) {
  const cover = coverImage(car.vehicle_images);
  if (!cover) return null;
  return (
    <Link href={carPath(car)} className="relative block min-w-0 flex-[1_1_380px]">
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
        {formatPrice(car.price_today_cents ?? car.daily_rate_cents)}
        <span className="font-sans text-sm font-medium text-slate"> a day</span>
      </span>
      <span className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-[18px] bg-white px-3.5 py-3">
        <span
          aria-hidden
          className="flex size-[42px] shrink-0 items-center justify-center rounded-[12px] bg-mint font-display text-lg font-extrabold"
        >
          C
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-base font-bold">
            {car.make} {car.model} {car.year}
          </span>
          <span className="truncate text-sm text-slate">Cascade Fleet · {car.location_name}</span>
        </span>
        <ArrowRight className="size-5 shrink-0" strokeWidth={2} />
      </span>
    </Link>
  );
}

export default async function HomePage() {
  const featured = await loadFeatured();
  const hero = featured.find((car) => coverImage(car.vehicle_images));

  return (
    <>
      <JsonLd data={ORGANIZATION} />
      <section className="bg-sky pt-8 pb-12 sm:pt-12 sm:pb-16">
        <Container className="flex flex-wrap items-center gap-8">
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
            <h1 className="headline text-[clamp(46px,7vw,112px)] leading-none text-ink">
              Car rental at Sea&#8209;Tac, without the rental counter.
            </h1>
            <p className="max-w-xl text-lg leading-snug text-ink/80">
              Book a car from a local, licensed fleet near Seattle-Tacoma International Airport.
              The price includes tax. We meet you at the car — no lines, no shuttle, no surprises.
            </p>
            <SearchForm />
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink/70">
              {TRUST_ITEMS.map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="size-3.5 shrink-0" strokeWidth={2.5} />
                  {t}
                </li>
              ))}
              <li className="flex items-center gap-1.5">
                <Phone className="size-3.5 shrink-0" strokeWidth={1.75} />
                {/* TODO: replace with local 206 number when acquired */}
                <a href="tel:+16502724085" className="font-semibold">
                  (650) 272-4085
                </a>
              </li>
            </ul>
          </div>
          {hero && <HeroCar car={hero} />}
        </Container>
      </section>

      <Container className="pt-12 sm:pt-14">
        <h2 className="headline mb-4 text-[28px] leading-[1.12] sm:mb-5 sm:text-[44px]">What&apos;s the trip?</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(250px,1fr))] sm:gap-4 sm:overflow-visible sm:px-0">
          {TRIP_CATEGORIES.map(({ key, title, blurb, icon: Icon, tone, page }) => (
            <Link
              key={key}
              href={`/seattle/${page}`}
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
          <h2 className="headline text-[28px] leading-[1.12] sm:text-[44px]">Popular at Sea-Tac Airport</h2>
          <Link
            href="/seattle"
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

      <Container className="py-14 sm:py-[72px]">
        <Faq items={RENTING_FAQ} title="Renting a car on Cascade" />
      </Container>
    </>
  );
}
