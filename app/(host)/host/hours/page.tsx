import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Vehicle, VehicleImage } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, PageTitle, Tile } from "@/components/kit";
import { CarPhoto, coverUrl } from "@/components/host/bits";
import { HoursEditor } from "@/components/host/hours/HoursEditor";
import { loadHostHours } from "@/lib/trip-rules";
import { RulesEditor } from "./RulesEditor";

export const instant = false;
export const metadata = { title: "Pickup and hours" };

type CarRow = Pick<
  Vehicle,
  | "id"
  | "make"
  | "model"
  | "status"
  | "location_name"
  | "location_address"
  | "min_trip_days"
  | "max_trip_days"
  | "advance_notice_hours"
  | "trip_buffer_hours"
  | "weekend_min_two_days"
  | "instant_book"
> & { vehicle_images: Pick<VehicleImage, "url" | "is_cover" | "position">[] };

export default async function PickupAndHoursPage({ searchParams }: PageProps<"/host/hours">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/hours");

  const [{ car: carParam }, hours, { data }] = await Promise.all([
    searchParams,
    loadHostHours(supabase, user.id),
    // The exact address is private: read it server-side, scoped to this host.
    createAdminClient()
      .from("vehicles")
      .select(
        "id, make, model, status, location_name, location_address, min_trip_days, max_trip_days, advance_notice_hours, trip_buffer_hours, weekend_min_two_days, instant_book, vehicle_images(url, is_cover, position)"
      )
      .eq("host_id", user.id)
      .order("created_at", { ascending: true })
      .overrideTypes<CarRow[], { merge: false }>(),
  ]);
  const cars = data ?? [];

  if (cars.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
        <PageTitle title="Pickup and hours" />
        <EmptyState
          title="No cars yet"
          body="Once you list a car, set where guests pick it up and how long they can book it for."
          action={
            <Button asChild>
              <Link href="/host/vehicles/new">List a car</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const car = cars.find((c) => c.id === carParam) ?? cars[0];
  const locked = car.status === "suspended";

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <PageTitle
        title="Pickup and hours"
        lead="When you can meet guests, where they collect each car, and the rules for booking it."
      />

      <HoursEditor hostId={user.id} initial={hours} />

      <h2 className="mt-3 text-[22px] leading-tight sm:text-[26px]">Each car</h2>

      {cars.length > 1 && (
        <nav aria-label="Car" className="flex flex-wrap gap-2">
          {cars.map((c) => (
            <Link
              key={c.id}
              href={`?car=${c.id}`}
              aria-current={c.id === car.id ? "true" : undefined}
              className={cn(
                "flex h-[46px] items-center gap-2 rounded-[12px] px-2 pr-3.5 text-[15px] font-bold transition-colors",
                c.id === car.id ? "bg-ink text-white" : "bg-white hover:bg-line"
              )}
            >
              <CarPhoto src={coverUrl(c.vehicle_images)} alt="" sizes="30px" className="h-6 w-[30px] rounded-[6px]" />
              {c.make} {c.model}
            </Link>
          ))}
        </nav>
      )}

      {locked && (
        <Tile tone="peach" className="text-[15px]">
          This car is suspended, so its settings can&apos;t be changed right now.
        </Tile>
      )}

      <RulesEditor
        key={car.id}
        vehicleId={car.id}
        locked={locked}
        initial={{
          location_name: car.location_name,
          location_address: car.location_address,
          min_trip_days: car.min_trip_days,
          max_trip_days: car.max_trip_days,
          advance_notice_hours: car.advance_notice_hours,
          trip_buffer_hours: car.trip_buffer_hours,
          weekend_min_two_days: car.weekend_min_two_days,
          instant_book: car.instant_book,
        }}
      />
    </div>
  );
}
