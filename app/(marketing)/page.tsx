import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeCheck, CalendarDays, Check, KeyRound, MapPin, Phone, PlaneLanding, Route, ShieldCheck, Undo2 } from "lucide-react";
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
    "Book a car from Cascade Fleet LLC near Seattle-Tacoma International Airport. Total price includes tax. Instant book, flexible cancellation, protection from $9.99/day.",
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

const BENEFITS = [
  {
    icon: PlaneLanding,
    title: "Easy airport pickup",
    body: "We meet you at the car — DoubleTree by Hilton SeaTac. No counter, no shuttle, no queue.",
  },
  {
    icon: BadgeCheck,
    title: "Price includes tax",
    body: "No surprise fees at checkout. The total you see is the total you pay.",
  },
  {
    icon: ShieldCheck,
    title: "Licensed fleet",
    body: `WA rental car registration #R64728. Protection from ${formatCurrency(PROTECTION_DAILY_CENTS.basic)}/day.`,
  },
];

async function loadFeatured() {
  const supabase = await createClient();
  // Fetch a larger pool so we can deduplicate and shuffle for variety.
  const { data } = await supabase
    .from("vehicles")
    .select(LISTED_VEHICLE_SELECT)
    .eq("status", "listed")
    .order("year", { ascending: false })
    .order("daily_rate_cents", { ascending: false })
    .limit(40);
  const pool = (data ?? []) as unknown as ListedVehicle[];

  // Allow at most 2 of the same make+model so one model doesn't dominate.
  const modelCount = new Map<string, number>();
  const deduped = pool.filter((car) => {
    const key = `${car.make}|${car.model}`;
    const count = modelCount.get(key) ?? 0;
    if (count >= 2) return false;
    modelCount.set(key, count + 1);
    return true;
  });

  // Shuffle within year groups: newer years first, random order within each year.
  const byYear = new Map<number, ListedVehicle[]>();
  for (const car of deduped) {
    if (!byYear.has(car.year)) byYear.set(car.year, []);
    byYear.get(car.year)!.push(car);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);
  const shuffled: ListedVehicle[] = [];
  for (const year of years) {
    const group = byYear.get(year)!;
    // Fisher-Yates within each year group
    for (let i = group.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [group[i], group[j]] = [group[j], group[i]];
    }
    shuffled.push(...group);
  }

  return withTodayPrices(shuffled.slice(0, 12));
}

function HeroCar({ car }: { car: ListedVehicle }) {
  const cover = coverImage(car.vehicle_images);
  if (!cover) return null;
  return (
    <Link href={carPath(car)} className="relative block min-w-0 flex-[1_1_320px]">
      <span className="relative block aspect-[1/0.86] overflow-hidden rounded-[28px]">
        <Image
          src={cover.url}
          alt={`${car.year} ${car.make} ${car.model} in ${car.location_name}`}
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 420px"
          className="object-cover"
        />
      </span>
      <span className="figures absolute top-3 left-3 rounded-[12px] bg-white px-3 py-2 font-display text-xl font-extrabold">
        {formatPrice(car.price_today_cents ?? car.daily_rate_cents)}
        <span className="font-sans text-xs font-medium text-slate"> a day</span>
      </span>
      <span className="absolute inset-x-3 bottom-3 flex items-center gap-2.5 rounded-[14px] bg-white px-3 py-2.5">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-mint font-display text-base font-extrabold"
        >
          C
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold">
            {car.make} {car.model} {car.year}
          </span>
          <span className="truncate text-xs text-slate">Cascade Fleet · {car.location_name}</span>
        </span>
        <ArrowRight className="size-4 shrink-0" strokeWidth={2} />
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

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="bg-sky pt-5 pb-8 sm:pt-7 sm:pb-10">
        <Container className="flex flex-wrap items-center gap-6 sm:gap-8">
          <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-4">
            <h1 className="headline text-[clamp(28px,3vw,40px)] leading-[1.08] text-ink">
              Rent a car in Seattle,{" "}
              <span className="text-ink/60">without the rental counter.</span>
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-ink/70 sm:text-base">
              Convenient Sea-Tac pickup. Great cars. Transparent pricing.
            </p>
            <SearchForm />
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink/60">
              {TRUST_ITEMS.map((t) => (
                <li key={t} className="flex items-center gap-1">
                  <Check className="size-3 shrink-0" strokeWidth={2.5} />
                  {t}
                </li>
              ))}
              <li className="flex items-center gap-1">
                <Phone className="size-3 shrink-0" strokeWidth={1.75} />
                <a href="tel:+16502724085" className="font-semibold">
                  (650) 272-4085
                </a>
              </li>
            </ul>
          </div>
          {hero && <HeroCar car={hero} />}
        </Container>
      </section>

      {/* ── Featured vehicles ─────────────────────────────────────────────── */}
      <Container className="pt-8 sm:pt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold sm:text-2xl">Popular at Sea-Tac Airport</h2>
          <Link
            href="/seattle"
            className="flex items-center gap-1 rounded-[10px] bg-board px-3.5 py-2.5 text-sm font-bold transition-colors hover:bg-line"
          >
            View all cars
            <ArrowRight className="size-4" strokeWidth={2} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 sm:gap-4">
          {featured.map((car, i) => (
            <VehicleCard key={car.id} vehicle={car} priority={i < 4} />
          ))}
        </div>
      </Container>

      {/* ── Benefits ──────────────────────────────────────────────────────── */}
      <section className="mt-8 bg-board py-8 sm:mt-10 sm:py-10">
        <Container>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {BENEFITS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4 rounded-[20px] bg-white p-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-board">
                  <Icon className="size-5 text-ink" strokeWidth={1.75} />
                </span>
                <span>
                  <p className="text-sm font-extrabold">{title}</p>
                  <p className="mt-0.5 text-sm leading-snug text-slate">{body}</p>
                </span>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Trip categories ───────────────────────────────────────────────── */}
      <Container className="pt-8 sm:pt-10">
        <h2 className="mb-4 text-xl font-extrabold sm:text-2xl">What&apos;s the trip?</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] sm:gap-3 sm:overflow-visible sm:px-0">
          {TRIP_CATEGORIES.map(({ key, title, blurb, icon: Icon, tone, page }) => (
            <Link
              key={key}
              href={`/seattle/${page}`}
              className={cn(
                "flex w-[140px] shrink-0 flex-col justify-between gap-5 rounded-[20px] p-3 transition-[filter] hover:brightness-[0.97] sm:min-h-[200px] sm:w-auto sm:rounded-[24px] sm:p-5",
                toneClass[tone]
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-[12px] bg-white text-ink sm:size-12 sm:rounded-[14px]">
                <Icon className="size-5 sm:size-6" strokeWidth={1.75} />
              </span>
              <span>
                <span className="block text-sm leading-tight font-extrabold text-ink sm:mb-1 sm:font-display sm:text-[24px] sm:leading-[1.12] sm:tracking-[-0.03em]">
                  {title}
                </span>
                <span className="hidden text-sm sm:block">{blurb}</span>
              </span>
            </Link>
          ))}
        </div>
      </Container>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="mt-8 bg-butter py-8 sm:mt-10 sm:py-10">
        <Container className="flex flex-col gap-5 sm:gap-6">
          <h2 className="headline text-[clamp(24px,3vw,40px)] leading-none">How a trip works</h2>
          <ol className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="flex flex-col gap-3 rounded-[20px] bg-white p-5">
                <span className="flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-[44px] items-center justify-center rounded-[13px]",
                      i === 0 ? "bg-ink text-white" : "bg-board text-ink"
                    )}
                  >
                    <Icon className="size-5" strokeWidth={1.75} />
                  </span>
                  <span aria-hidden className="font-display text-[40px] leading-none font-extrabold text-butter">
                    {i + 1}
                  </span>
                </span>
                <span className="font-display text-xl font-extrabold">{title}</span>
                <span className="text-sm leading-[1.45] text-slate">{body}</span>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <Container className="py-10 sm:py-14">
        <Faq items={RENTING_FAQ} title="Renting a car on Cascade" />
      </Container>
    </>
  );
}
