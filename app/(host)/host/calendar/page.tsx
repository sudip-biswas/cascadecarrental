import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { settleTripStatuses } from "@/lib/trips";
import { toDateKey } from "@/lib/utils";
import type { Database, Vehicle, VehicleImage } from "@/lib/supabase/types";
import { EmptyState, PageTitle } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { MultiCalendar, type PriceOverrides } from "@/components/host/MultiCalendar";
import { coverUrl } from "@/components/host/bits";
import { loadHostTrips, occupantsFor } from "@/components/host/data";
import { addDays } from "@/components/host/days";
import { cityOf } from "@/components/host/calendar/filters";

export const instant = false;
export const metadata = { title: "Calendar" };

type CarRow = Pick<
  Vehicle,
  | "id"
  | "make"
  | "model"
  | "trim"
  | "year"
  | "license_plate"
  | "status"
  | "location_name"
  | "location_address"
  | "daily_rate_cents"
> & {
  vehicle_images: Pick<VehicleImage, "url" | "is_cover" | "position">[];
};

/** How far ahead hosts can price, and so how far the calendar scrolls. */
const HORIZON_DAYS = 365;

/** Every price row in the range. PostgREST pages at 1,000 rows and a fleet's year runs past that. */
async function loadPrices(
  supabase: SupabaseClient<Database>,
  carIds: string[],
  from: string,
  to: string
) {
  const rows: { vehicle_id: string; date: string; price_cents: number }[] = [];
  for (let page = 0; ; page++) {
    const { data } = await supabase
      .from("vehicle_daily_prices")
      .select("vehicle_id, date, price_cents")
      .in("vehicle_id", carIds)
      .gte("date", from)
      .lte("date", to)
      .order("vehicle_id")
      .order("date")
      .range(page * 1000, page * 1000 + 999);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) return rows;
  }
}

export default async function HostCalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/calendar");

  const today = toDateKey(new Date());

  // Step 1 – fetch cars (needed to know IDs for downstream queries). Settling trip
  // statuses only touches trips, so it runs alongside instead of in front.
  const [{ data }] = await Promise.all([
    supabase
      .from("vehicles")
      .select(
        "id, make, model, trim, year, license_plate, status, location_name, location_address, daily_rate_cents, vehicle_images(url, is_cover, position)"
      )
      .eq("host_id", user.id)
      .order("created_at", { ascending: true }),
    settleTripStatuses(user.id),
  ]);

  const cars = (data ?? []) as unknown as CarRow[];

  if (cars.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <PageTitle title="Calendar" />
        <EmptyState
          title="No cars yet"
          body="List a car and its trips, requests and blocked days show up here."
          action={
            <Button asChild>
              <Link href="/host/vehicles/new">
                <Plus /> List a car
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const carIds = cars.map((c) => c.id);

  // Step 2 – fetch trips, blocks, and price overrides in parallel
  const [trips, { data: blocksData }, priceRows] = await Promise.all([
    loadHostTrips(supabase, user.id, ["pending", "approved", "active", "completed"]),
    createAdminClient()
      .from("vehicle_availability")
      .select("id, vehicle_id, blocked_from, blocked_to, reason")
      .in("vehicle_id", carIds),
    loadPrices(supabase, carIds, addDays(today, -30), addDays(today, HORIZON_DAYS)),
  ]);

  // Build price overrides map: { [vehicleId]: { [date]: price_cents } }
  const priceOverrides: PriceOverrides = {};
  for (const row of priceRows) {
    if (!priceOverrides[row.vehicle_id]) priceOverrides[row.vehicle_id] = {};
    priceOverrides[row.vehicle_id][row.date] = row.price_cents;
  }

  return (
    <Suspense>
      <MultiCalendar
        today={today}
        horizon={addDays(today, HORIZON_DAYS)}
        priceOverrides={priceOverrides}
        cars={cars.map((c) => ({
          id: c.id,
          name: `${c.make} ${c.model}`,
          trim: c.trim,
          year: c.year,
          plate: c.license_plate,
          status: c.status,
          place: c.location_name,
          city: cityOf(c.location_address, c.location_name),
          cover: coverUrl(c.vehicle_images),
          dailyRateCents: c.daily_rate_cents,
          occupants: occupantsFor(c.id, trips, blocksData ?? []),
        }))}
      />
    </Suspense>
  );
}
