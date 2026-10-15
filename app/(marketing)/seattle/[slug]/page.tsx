import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CITY, RENTAL_PAGES, rentalPage } from "@/lib/rentals";
import { OPEN_GRAPH } from "@/lib/site";
import { publicCars } from "@/components/seo/cars";
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
  const cars = await publicCars(page.filters);
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
    />
  );
}
