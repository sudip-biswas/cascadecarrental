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
import { HostCalendar } from "@/components/host/CalendarView";
import { coverUrl } from "@/components/host/bits";
import { loadHostTrips, occupantsFor } from "@/components/host/data";

export const instant = false;
export const metadata = { title: "Calendar" };

type CarRow = Pick<Vehicle, "id" | "make" | "model" | "daily_rate_cents"> & {
  vehicle_images: Pick<VehicleImage, "url" | "is_cover" | "position">[];
};

export default async function HostCalendarPage({ searchParams }: PageProps<"/host/calendar">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/calendar");

  await settleTripStatuses(user.id);
  const [{ data }, trips, { car: carParam }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, make, model, daily_rate_cents, vehicle_images(url, is_cover, position)")
      .eq("host_id", user.id)
      .order("created_at", { ascending: true }),
    loadHostTrips(supabase, user.id, ["pending", "approved", "active", "completed"]),
    searchParams,
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

  // Block notes are private: read them server-side, only for this host's cars.
  const { data: blocks } = await createAdminClient()
    .from("vehicle_availability")
    .select("id, vehicle_id, blocked_from, blocked_to, reason")
    .in("vehicle_id", cars.map((c) => c.id));

  const carId = cars.some((c) => c.id === carParam) ? (carParam as string) : cars[0].id;

  return (
    <Suspense>
      <HostCalendar
        today={toDateKey(new Date())}
        carId={carId}
        cars={cars.map((c) => ({
          id: c.id,
          name: `${c.make} ${c.model}`,
          cover: coverUrl(c.vehicle_images),
          dailyRateCents: c.daily_rate_cents,
          occupants: occupantsFor(c.id, trips, blocks ?? []),
        }))}
      />
    </Suspense>
  );
}
