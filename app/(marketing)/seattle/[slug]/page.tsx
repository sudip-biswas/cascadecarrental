import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CITY, RENTAL_PAGES, rentalPage } from "@/lib/rentals";
import { OPEN_GRAPH } from "@/lib/site";
import { publicCars } from "@/components/seo/cars";
import { monthPrice } from "@/components/search/vehicle";
import { RentalLanding } from "@/components/seo/RentalLanding";

export function generateStaticParams() {
  return RENTAL_PAGES.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/seattle/[slug]">): Promise<Metadata> {
  const page = rentalPage((await params).slug);
  if (!page) return {};
  const cars = await publicCars(page.filters);
  const path = `/seattle/${page.slug}`;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: path },
    openGraph: { ...OPEN_GRAPH, title: page.title, description: page.description, url: path },
    // An empty page is thin content; it joins the index once a car is listed.
    ...(cars.length ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function RentalPage({ params }: PageProps<"/seattle/[slug]">) {
  const page = rentalPage((await params).slug);
  if (!page) notFound();
  const isMonthly = page.slug === "monthly-car-rental";
  let cars = await publicCars(page.filters);

  let fromPriceCents: number | null = null;
  if (isMonthly) {
    // Sort by monthly price ascending (cheapest first), falling back to daily rate.
    cars = [...cars].sort((a, b) => {
      const ma = monthPrice(a)?.cents ?? a.daily_rate_cents * 30;
      const mb = monthPrice(b)?.cents ?? b.daily_rate_cents * 30;
      return ma - mb;
    });
    fromPriceCents = cars.reduce<number | null>((min, car) => {
      const p = monthPrice(car);
      if (!p) return min;
      return min === null || p.cents < min ? p.cents : min;
    }, null);
  }

  return (
    <RentalLanding
      crumbs={[
        { name: "Cascade", path: "/" },
        { name: `Car rental in ${CITY}`, path: "/seattle" },
        { name: page.h1, path: `/seattle/${page.slug}` },
      ]}
      h1={page.h1}
      intro={page.intro}
      cars={cars}
      searchHref={`/search?${new URLSearchParams(page.search).toString()}`}
      faq={page.faq}
      current={page.slug}
      monthlyMode={isMonthly}
      fromPriceCents={fromPriceCents}
    />
  );
}
