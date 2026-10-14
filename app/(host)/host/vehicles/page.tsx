import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn, formatDateShort, formatPrice } from "@/lib/utils";
import type { Vehicle, VehicleImage } from "@/lib/supabase/types";
import { Fact, PageTitle } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { CarPhoto, coverUrl, STATUS_DOT } from "@/components/host/bits";
import { isRequest, loadHostTrips, type HostTrip } from "@/components/host/data";

export const instant = false;
export const metadata = { title: "Cars" };

type CarRow = Pick<Vehicle, "id" | "make" | "model" | "year" | "trim" | "daily_rate_cents" | "status" | "trip_count"> & {
  vehicle_images: Pick<VehicleImage, "url" | "is_cover" | "position">[];
};

function nextFor(carId: string, trips: HostTrip[]) {
  const now = Date.now();
  const next = trips.find(
    (t) =>
      t.vehicle_id === carId &&
      (t.status === "active" || ((isRequest(t) || t.status === "approved") && new Date(t.starts_at).getTime() > now))
  );
  if (!next) return { label: "Nothing yet", tone: "board" as const };
  if (next.status === "active") return { label: "On a trip", tone: "sky" as const };
  return isRequest(next)
    ? { label: `${formatDateShort(next.starts_at)} ask`, tone: "butter" as const }
    : { label: formatDateShort(next.starts_at), tone: "mint" as const };
}

export default async function HostCarsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/vehicles");

  const [{ data }, trips] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, make, model, year, trim, daily_rate_cents, status, trip_count, vehicle_images(url, is_cover, position)")
      .eq("host_id", user.id)
      .order("created_at", { ascending: true }),
    loadHostTrips(supabase, user.id, ["pending", "approved", "active"]),
  ]);
  const cars = (data ?? []) as unknown as CarRow[];

  return (
    <div className="flex flex-col gap-4">
      <PageTitle
        title="Cars"
        action={
          <Button asChild size="lg" className="text-base">
            <Link href="/host/vehicles/new">
              <Plus /> List a car
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-4">
        {cars.map((car) => {
          const status = STATUS_DOT[car.status];
          const next = nextFor(car.id, trips);
          const name = `${car.make} ${car.model}`;
          return (
            <Link
              key={car.id}
              href={`/host/vehicles/${car.id}`}
              className="group flex flex-col gap-4 rounded-[30px] bg-white px-3 pt-3 pb-5 transition-colors hover:bg-white/70"
            >
              <span className="relative block">
                <CarPhoto
                  src={coverUrl(car.vehicle_images)}
                  alt={name}
                  sizes="(max-width: 768px) 100vw, 420px"
                  className="aspect-[16/10] w-full rounded-[22px]"
                />
                <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-[10px] bg-white px-2.5 py-1.5 text-[13px] font-bold">
                  <span className={cn("size-2 rounded-full", status.dot)} />
                  {status.label}
                </span>
              </span>
              <span className="flex flex-col gap-3 px-2">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-display text-[28px] font-extrabold tracking-[-0.02em] sm:text-[30px]">
                    {name}
                  </span>
                  <span className="shrink-0 text-[15px] text-slate">
                    {car.year}
                    {car.trim ? ` ${car.trim}` : ""}
                  </span>
                </span>
                <span className="figures grid grid-cols-3 gap-2">
                  <Fact label="Price" value={`${formatPrice(car.daily_rate_cents)}/day`} className="rounded-[16px] p-3" />
                  <Fact label="Trips" value={car.trip_count} className="rounded-[16px] p-3" />
                  <Fact label="Next" value={next.label} tone={next.tone} className="rounded-[16px] p-3" />
                </span>
              </span>
            </Link>
          );
        })}

        <Link
          href="/host/vehicles/new"
          className="flex min-h-[300px] flex-col items-center justify-center gap-3.5 rounded-[30px] bg-line p-6 text-center transition-colors hover:bg-[#dfe2e7]"
        >
          <span className="flex size-16 items-center justify-center rounded-[20px] bg-white">
            <Plus className="size-7" strokeWidth={2} />
          </span>
          <span className="font-display text-[24px] font-extrabold">
            {cars.length ? "Add another car" : "List your first car"}
          </span>
          <span className="text-[15px] text-slate">The car, a few photos and a daily price</span>
        </Link>
      </div>
    </div>
  );
}
