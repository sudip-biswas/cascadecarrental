import Link from "next/link";
import { ArrowRight, CalendarSearch, ChevronRight } from "lucide-react";
import { RENTAL_PAGES, type Faq as FaqItem } from "@/lib/rentals";
import { absoluteUrl, carPath } from "@/lib/site";
import { Container, EmptyState } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { VehicleCard } from "@/components/search/VehicleCard";
import type { ListedVehicle } from "@/components/search/vehicle";
import { Faq } from "./Faq";
import { JsonLd } from "./JsonLd";

interface Crumb {
  name: string;
  path: string;
}

interface Props {
  crumbs: Crumb[];
  h1: string;
  intro: string[];
  cars: ListedVehicle[];
  /** The same cars on search, where guests add dates and filters. */
  searchHref: string;
  faq?: FaqItem[];
  /** This page's slug, left out of the links to the others. */
  current?: string;
}

/** A crawlable page of Seattle cars for one kind of trip. */
export function RentalLanding({ crumbs, h1, intro, cars, searchHref, faq, current }: Props) {
  const others = RENTAL_PAGES.filter((p) => p.slug !== current);

  return (
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
        <h1 className="headline text-[clamp(40px,6vw,88px)] leading-none">{h1}</h1>
        <div className="flex max-w-[68ch] flex-col gap-3 text-[17px] leading-[1.5] text-slate">
          {intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </div>

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
              <VehicleCard key={car.id} vehicle={car} priority={i < 3} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CalendarSearch />}
            title="Nothing listed here yet"
            body="Cascade is new in Seattle and hosts are still joining. Every car we have is on the Seattle page."
            action={
              <Button asChild>
                <Link href="/seattle">See every car</Link>
              </Button>
            }
          />
        )}
      </section>

      {faq?.length ? <Faq items={faq} /> : null}

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
  );
}
