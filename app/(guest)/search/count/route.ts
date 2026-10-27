import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseSearchParams } from "@/components/search/params";
import { searchStats } from "@/components/search/search";

/** How many cars a search would show, for the filter menus' "Show 12 cars" button. */
export async function GET(request: NextRequest) {
  const filters = parseSearchParams(Object.fromEntries(request.nextUrl.searchParams));
  const stats = await searchStats(await createClient(), filters);
  return Response.json(stats, { headers: { "Cache-Control": "no-store" } });
}
