import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { settleTripStatuses } from "@/lib/trips";
import { toDateKey } from "@/lib/utils";
import type { Vehicle, VehicleImage } from "@/lib/supabase/types";
import { EmptyState, PageTitle } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { MultiCalendar, type PriceOverrides } from "@/components/host/MultiCalendar";
import { coverUrl } from "@/components/host/bits";
import { loadHostTrips, occupantsFor } from "@/components/host/data";
import { addDays } from "@/components/host/days";

export const instant = false;
export const metadata = { title: "Calendar" };

type CarRow = Pick<Vehicle, "id" | "make" | "model" | "daily_rate_cents"> & {
  vehicle_images: Pick<VehicleImage, "url" | "is_cover" | "position">[];
};

export default async function HostCalendarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/calendar");

  await settleTripStatuses(user.id);

  const today = toDateKey(new Date());

  // Step 1 – fetch cars (needed to know IDs for downstream queries)
  const { data } = await supabase
    .from("vehicles")
    .select("id, make, model, daily_rate_cents, vehicle_images(url, is_cover, position)")
    .eq("host_id", user.id)
    .order("created_at", { ascending: true });

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
  const priceFrom = addDays(today, -7);
  const priceTo = addDays(today, 90);

  // Step 2 – fetch trips, blocks, and price overrides in parallel
  const [trips, { data: blocksData }, { data: priceRows }] = await Promise.all([
    loadHostTrips(supabase, user.id, ["pending", "approved", "active", "completed"]),
    createAdminClient()
      .from("vehicle_availability")
      .select("id, vehicle_id, blocked_from, blocked_to, reason")
      .in("vehicle_id", carIds),
    supabase
      .from("vehicle_daily_prices")
      .select("vehicle_id, date, price_cents")
      .in("vehicle_id", carIds)
      .gte("date", priceFrom)
      .lte("date", priceTo),
  ]);

  // Build price overrides map: { [vehicleId]: { [date]: price_cents } }
  const priceOverrides: PriceOverrides = {};
  for (const row of priceRows ?? []) {
    if (!priceOverrides[row.vehicle_id]) priceOverrides[row.vehicle_id] = {};
    priceOverrides[row.vehicle_id][row.date] = row.price_cents;
  }

  return (
    <Suspense>
      <MultiCalendar
        today={today}
        priceOverrides={priceOverrides}
        cars={cars.map((c) => ({
          id: c.id,
          name: `${c.make} ${c.model}`,
          cover: coverUrl(c.vehicle_images),
          dailyRateCents: c.daily_rate_cents,
          occupants: occupantsFor(c.id, trips, blocksData ?? []),
        }))}
      />
    </Suspense>
  );
}
