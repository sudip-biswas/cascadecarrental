import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { listedCars } from "@/components/search/listings";
import { RENTAL_PAGES } from "@/lib/rentals";
import { absoluteUrl, carPath } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  "use cache";
  cacheLife("hours");

  const supabase = createPublicClient();
  const all = await listedCars(supabase, { sort: "newest" });
  const lastChange = all.map((c) => c.updated_at).sort().at(-1);

  // Rental pages with no cars yet are noindex, so they stay out until they fill.
  const pages = await Promise.all(
    RENTAL_PAGES.map(async (page) => ({ page, cars: await listedCars(supabase, page.filters) }))
  );

  return [
    { url: absoluteUrl("/"), lastModified: lastChange, changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/seattle"), lastModified: lastChange, changeFrequency: "daily", priority: 0.9 },
    ...pages
      .filter(({ cars }) => cars.length > 0)
      .map(({ page, cars }) => ({
        url: absoluteUrl(`/seattle/${page.slug}`),
        lastModified: cars.map((c) => c.updated_at).sort().at(-1),
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
    ...all.map((car) => ({
      url: absoluteUrl(carPath(car)),
      lastModified: car.updated_at,
      changeFrequency: "weekly" as const,
      priority: 0.7,
      images: car.vehicle_images.map((img) => img.url),
    })),
  ];
}
