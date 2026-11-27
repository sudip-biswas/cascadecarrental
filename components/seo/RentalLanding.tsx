import Link from "next/link";
import { ArrowRight, CalendarSearch, ChevronRight, PlaneLanding } from "lucide-react";
import { AIRPORT, DISCOUNT_TIERS, DEFAULT_DISCOUNTS } from "@/lib/pricing";
import { RENTAL_PAGES, type Faq as FaqItem } from "@/lib/rentals";
import { absoluteUrl, carPath } from "@/lib/site";
import { Container, EmptyState, Tile } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { VehicleCard } from "@/components/search/VehicleCard";
import { SearchForm } from "@/components/search/SearchForm";
import type { ListedVehicle } from "@/components/search/vehicle";
import { Faq } from "./Faq";
import { JsonLd } from "./JsonLd";
import { ReviewsSection } from "./ReviewsSection";

interface Crumb {
  name: string;
  path: string;
}

interface Props {
  crumbs: Crumb[];
  h1: string;
  intro: string[];
  cars: ListedVehicle[];
  /** The same cars on search, where guests can add dates and filters. */
  searchHref: string;
  faq?: FaqItem[];
  /** This page's slug, left out of the links to the others. */
  current?: string;
  /** Monthly landing page mode: hero search, discount ladder, extra sections. */
  monthlyMode?: boolean;
  /** Cheapest car's monthly price (pre-tax cents), shown in the hero. */
  fromPriceCents?: number | null;
}

/** A crawlable page of Seattle cars for one kind of trip. */
export function RentalLanding({ crumbs, h1, intro, cars, searchHref, faq, current, monthlyMode, fromPriceCents }: Props) {
  const others = RENTAL_PAGES.filter((p) => p.slug !== current);

  return (
    <div className="flex flex-col">
      <Container className="flex flex-col gap-12 pt-6 pb-16 sm:gap-16 sm:pt-8">
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: crumbs.map((crumb, i) => ({
                "@type": "ListItem",
                position: i + 1,
                name: crumb.name,
                item: absoluteUrl(crumb.path),
              })),
            },
            {
              "@context": "https://schema.org",
              "@type": "ItemList",
              name: h1,
              numberOfItems: cars.length,
              itemListElement: cars.map((car, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: absoluteUrl(carPath(car)),
                name: `${car.year} ${car.make} ${car.model}`,
              })),
            },
          ]}
        />

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1 text-sm text-slate">
              {crumbs.map((crumb, i) => (
                <li key={crumb.path} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3.5" strokeWidth={2} />}
                  {i < crumbs.length - 1 ? (
                    <Link href={crumb.path} className="hover:text-ink">
                      {crumb.name}
                    </Link>
                  ) : (
                    <span aria-current="page" className="font-semibold text-ink">
                      {crumb.name}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <h1 className="headline text-[clamp(30px,4vw,44px)] leading-none">{h1}</h1>
          <div className="flex max-w-[68ch] flex-col gap-3 text-[17px] leading-[1.5] text-slate">
            {intro.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          {monthlyMode && fromPriceCents != null && (
            <p className="text-[17px] font-semibold text-slate">
              Monthly rentals from{" "}
              <span className="figures font-extrabold text-ink">
                ${Math.round(fromPriceCents / 100).toLocaleString()}/month
              </span>
            </p>
          )}
          {monthlyMode && (
            <SearchForm
              showMonthsToggle
              months={1}
              where="SeaTac Airport"
              initialGeo={{ lat: AIRPORT.lat, lng: AIRPORT.lng }}
              size="lg"
              className="mt-1 max-w-3xl"
            />
          )}
        </div>

        {/* ── Discount ladder ────────────────────────────────────────────── */}
        {monthlyMode && (
          <section aria-label="Discount tiers" className="rounded-[22px] bg-cascade-100 px-6 py-5">
            <p className="mb-3 text-[15px] font-bold text-cascade-900">Automatic discounts — applied at checkout, no code needed</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {DISCOUNT_TIERS.map((tier) => {
                const pct = DEFAULT_DISCOUNTS[tier.column];
                return (
                  <span key={tier.column} className="flex items-baseline gap-1.5 text-[15px]">
                    <span className="font-semibold text-cascade-900">{tier.days}+ days</span>
                    <span className="figures font-extrabold text-cascade-700">save {pct}%</span>
                  </span>
                );
              })}
            </div>
            <p className="mt-2 text-[13px] text-cascade-700">
              Every trip gets the best tier it qualifies for — up to {DEFAULT_DISCOUNTS.monthly_discount_pct}% for 30+ days.
            </p>
          </section>
        )}

        {/* ── Pickup strip ───────────────────────────────────────────────── */}
        <Tile tone="sky" className="flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-white/60">
            <PlaneLanding className="size-5" strokeWidth={1.75} />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-[17px] font-extrabold">Pickup is easy — we meet you at the car</span>
            <span className="text-[15px] leading-snug opacity-70">We deliver to the SeaTac Airport parking garage or the DoubleTree by Hilton SeaTac. No rental counter, no shuttle, no queue — text us when you land and your car is waiting.</span>
          </span>
        </Tile>

        {/* ── Car grid ───────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-4 sm:gap-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="headline text-[28px] leading-[1.12] sm:text-[44px]">
              {cars.length ? `${cars.length} ${cars.length === 1 ? "car" : "cars"} to rent` : "No cars yet"}
            </h2>
            {cars.length > 0 && (
              <Link
                href={searchHref}
                className="flex items-center gap-1.5 rounded-[12px] bg-white px-4 py-3 text-base font-bold transition-colors hover:bg-line"
              >
                Pick your dates
                <ArrowRight className="size-[18px]" strokeWidth={2} />
              </Link>
            )}
          </div>
          {cars.length ? (
            <div className="grid gap-4 sm:grid-cols-[repeat(auto-fill,minmax(270px,1fr))]">
              {cars.map((car, i) => (
                <VehicleCard key={car.id} vehicle={car} priceMode={monthlyMode ? "month" : undefined} priority={i < 3} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<CalendarSearch />}
              title="Nothing listed here yet"
              body="Cascade is new in Seattle and are still joining. Every car we have is on the Seattle page."
              action={
                <Button asChild>
                  <Link href="/seattle">See every car</Link>
                </Button>
              }
            />
          )}
        </section>

        {/* ── How it works ───────────────────────────────────────────────── */}
        {monthlyMode && (
          <section className="flex flex-col gap-5">
            <h2 className="headline text-[28px] leading-[1.12] sm:text-[44px]">How it works</h2>
            <ol className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  n: "1",
                  head: "Pick a car and choose 30 days or more",
                  body: "The monthly rate applies automatically — no code, nothing to ask for. Shorter trips get the best tier they qualify for.",
                },
                {
                  n: "2",
                  head: "Book as a guest, no account needed",
                  body: "The full total, including tax, is shown before you pay. Pay the flexible rate to cancel any time, or save 9% with pay-now.",
                },
                {
                  n: "3",
                  head: "Pick up at SeaTac or the DoubleTree",
                  body: "We meet you at the SeaTac Airport parking garage or the DoubleTree by Hilton SeaTac. Pickup and return 8 AM – 11 PM.",
                },
              ].map((step) => (
                <li key={step.n} className="flex flex-col gap-3 rounded-[22px] bg-white p-5">
                  <span className="flex size-9 items-center justify-center rounded-full bg-cascade-100 text-[15px] font-extrabold text-cascade-900">
                    {step.n}
                  </span>
                  <span className="text-[17px] font-bold">{step.head}</span>
                  <span className="text-[15px] leading-snug text-slate">{step.body}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* ── Who it's for ───────────────────────────────────────────────── */}
        {monthlyMode && (
          <section className="flex flex-col gap-5">
            <h2 className="headline text-[28px] leading-[1.12] sm:text-[44px]">Who it's for</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: "🏙️", head: "Relocating to Seattle", body: "New to the city and need a car while you get settled — book a month or two and extend as you go." },
                { icon: "🔧", head: "Between cars or waiting on a repair", body: "Your car is in the shop or you're in between vehicles — a monthly rate beats a hotel-length daily rate." },
                { icon: "💼", head: "Work assignments and travel healthcare", body: "On a contract or travelling nurse assignment — a monthly car with 6,000 miles included covers most schedules." },
                { icon: "✈️", head: "Long visits and extended stays", body: "Visiting family for a few weeks or making Seattle your base for the season — monthly pricing makes it easy." },
              ].map((tile) => (
                <li key={tile.head} className="flex flex-col gap-2 rounded-[22px] bg-white p-5">
                  <span className="text-2xl" aria-hidden="true">{tile.icon}</span>
                  <span className="text-[16px] font-bold">{tile.head}</span>
                  <span className="text-[14px] leading-snug text-slate">{tile.body}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Comparison strip ───────────────────────────────────────────── */}
        {monthlyMode && (
          <section className="flex flex-col gap-5">
            <h2 className="headline text-[28px] leading-[1.12] sm:text-[44px]">Long-term with Cascade vs a rental counter</h2>
            <div className="overflow-x-auto rounded-[22px] bg-white">
              <table className="w-full min-w-[500px] border-collapse text-[15px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="p-4 text-left font-semibold text-slate" />
                    <th className="p-4 text-left font-bold text-ink">Cascade</th>
                    <th className="p-4 text-left font-semibold text-slate">Rental counter</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      feature: "The car you get",
                      cascade: "The exact car you booked",
                      counter: "Class booked, not the exact car — \u201cor similar\u201d",
                    },
                    {
                      feature: "Pickup",
                      cascade: "No counter — we meet you at the car",
                      counter: "Counter queue, shuttle, then car lot",
                    },
                    {
                      feature: "Monthly discount",
                      cascade: "Applied automatically, no membership or promo code",
                      counter: "Varies; often requires a loyalty card",
                    },
                    {
                      feature: "Miles included",
                      cascade: "6,000 miles per 30-day rental (200/day)",
                      counter: "Often limited or metered on monthly rates",
                    },
                    {
                      feature: "Cancellation",
                      cascade: "Free before pick-up on the flexible rate",
                      counter: "Varies by rate; fees common on monthly",
                    },
                  ].map((row) => (
                    <tr key={row.feature} className="border-b border-line last:border-0">
                      <td className="p-4 font-semibold text-slate">{row.feature}</td>
                      <td className="p-4 font-semibold text-cascade-700">{row.cascade}</td>
                      <td className="p-4 text-slate">{row.counter}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {faq?.length ? <Faq items={faq} /> : null}

        {/* ── Reviews ────────────────────────────────────────────────────── */}
        {!monthlyMode && current === "airport-car-rental" && <ReviewsSection />}

        <section className="flex flex-col gap-4 sm:gap-5">
          <h2 className="headline text-[28px] leading-[1.12] sm:text-[44px]">More ways to rent in Seattle</h2>
          <ul className="grid gap-2 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
            {current && (
              <li>
                <Link href="/seattle" className="flex items-center justify-between gap-3 rounded-[18px] bg-white p-4 text-base font-bold hover:bg-line">
                  Every car in Seattle
                  <ArrowRight className="size-[18px]" strokeWidth={2} />
                </Link>
              </li>
            )}
            {others.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/seattle/${p.slug}`}
                  className="flex items-center justify-between gap-3 rounded-[18px] bg-white p-4 text-base font-bold hover:bg-line"
                >
                  {p.h1}
                  <ArrowRight className="size-[18px]" strokeWidth={2} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </Container>

      {/* ── Reviews (monthly: full-bleed below content) ─────────────────── */}
      {monthlyMode && <ReviewsSection />}
    </div>
  );
}
