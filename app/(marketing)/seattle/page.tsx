import type { Metadata } from "next";
import { CITY } from "@/lib/rentals";
import { OPEN_GRAPH } from "@/lib/site";
import { publicCars } from "@/components/seo/cars";
import { RentalLanding } from "@/components/seo/RentalLanding";

const title = "Car rental in Seattle from local hosts";
const description =
  "Rent a car from a host in Seattle. SUVs, trucks, EVs and more, with the full price including tax shown up front and miles included every day.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/seattle" },
  openGraph: { ...OPEN_GRAPH, title, description, url: "/seattle" },
};

export default async function SeattlePage() {
  const cars = await publicCars({ sort: "rating" });
  return (
    <RentalLanding
      crumbs={[
        { name: "Cascade", path: "/" },
        { name: `Car rental in ${CITY}`, path: "/seattle" },
      ]}
      h1={`Car rental in ${CITY}`}
      intro={[
        "Every car on Cascade belongs to someone around Seattle. Pick one, choose your dates and pay, then meet the host at the car to get the keys.",
        "Prices include tax, every car shows the miles included per day, and hosts often discount trips of a week or longer.",
      ]}
      cars={cars}
      searchHref="/search"
    />
  );
}
