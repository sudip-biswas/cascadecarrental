import { cacheLife } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { listedCars } from "@/components/search/listings";
import type { SearchFilters } from "@/components/search/params";

/** Listed cars for the public pages, cached so they're served as static HTML. */
export async function publicCars(filters: Partial<SearchFilters>) {
  "use cache";
  cacheLife("minutes");
  return listedCars(createPublicClient(), filters);
}
