import { RENTAL_PAGES, RENTING_FAQ } from "@/lib/rentals";
import { absoluteUrl, carPath } from "@/lib/site";
import { formatPrice } from "@/lib/utils";
import { publicCars } from "@/components/seo/cars";

/** A plain summary of the site for AI assistants (llmstxt.org). */
async function body() {
  const cars = await publicCars({ sort: "price" });
  return [
    "# Cascade",
    "",
    "> Peer-to-peer car rental in Seattle, WA. Guests rent cars from local hosts, see the full price with tax before paying, and pick the car up from the host.",
    "",
    "## Car rental in Seattle",
    "",
    `- [All cars in Seattle](${absoluteUrl("/seattle")})`,
    ...RENTAL_PAGES.map((p) => `- [${p.h1}](${absoluteUrl(`/seattle/${p.slug}`)}): ${p.description}`),
    "",
    "## Cars",
    "",
    ...cars.map(
      (c) =>
        `- [${c.year} ${c.make} ${c.model}](${absoluteUrl(carPath(c))}): ${c.location_name}, ${c.seats} seats, ${formatPrice(c.daily_rate_cents)} a day`
    ),
    "",
    "## How renting works",
    "",
    ...RENTING_FAQ.flatMap(({ q, a }) => [`### ${q}`, "", a, ""]),
  ].join("\n");
}

export async function GET() {
  return new Response(await body(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
