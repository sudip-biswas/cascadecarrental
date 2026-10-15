/**
 * The one address search engines should know. cascadecarrental.com and the
 * vercel.app address both lead here, so canonical links always name it.
 */
export const SITE_URL = process.env.VERCEL ? "https://www.cascadecarrental.com" : "http://localhost:3000";

export const SITE_NAME = "Cascade";

/** Only production gets crawled; previews would be duplicate copies. */
export const INDEXABLE = process.env.VERCEL_ENV === "production" || !process.env.VERCEL;

export const NO_INDEX = { robots: { index: false, follow: false } };

/**
 * A page's openGraph replaces the parent's, image included, so pages spread
 * this into theirs. The image is app/opengraph-image.tsx.
 */
export const OPEN_GRAPH = {
  type: "website" as const,
  siteName: SITE_NAME,
  locale: "en_US",
  images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Cascade: rent a car from a local host in Seattle" }],
};

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

/** "2024-toyota-rav4-capitol-hill-seattle" */
function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

type CarNaming = { id: string; year: number; make: string; model: string; location_name?: string | null };

/** A car's page, with words people search for ahead of its id. */
export function carPath(car: CarNaming) {
  const words = slugify([car.year, car.make, car.model, car.location_name].filter(Boolean).join(" "));
  return `/cars/${words ? `${words}-` : ""}${car.id}`;
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The car id at the end of a car page slug, or null if there isn't one. */
export function carIdFromSlug(slug: string) {
  return slug.match(UUID)?.[0].toLowerCase() ?? null;
}
