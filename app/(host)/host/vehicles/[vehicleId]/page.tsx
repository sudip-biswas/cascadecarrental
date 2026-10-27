import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hostEarningsCents } from "@/lib/pricing";
import { carPath } from "@/lib/site";
import { formatCurrency, formatPrice, formatRange, pluralize } from "@/lib/utils";
import type { Vehicle, VehicleExtra, VehicleImage } from "@/lib/supabase/types";
import { Fact, Tag } from "@/components/kit";
import { CarPhoto, coverUrl, firstName, Initial } from "@/components/host/bits";
import { isRequest, loadHostTrips } from "@/components/host/data";
import { PhotoManager } from "@/components/host/PhotoManager";
import { VehicleStatusToggle } from "@/components/host/VehicleStatusToggle";
import { VehicleEditDialog } from "@/components/host/VehicleEditDialog";
import { DeleteVehicleButton } from "@/components/host/DeleteVehicleButton";
import { CarSettings } from "@/components/host/settings/CarSettings";
import { formatBuffer } from "@/lib/trip-rules";
import { PricingDiscounts } from "@/components/host/settings/PricingDiscounts";
import { ExtrasManager } from "@/components/host/settings/ExtrasManager";
import { GuestInstructions } from "@/components/host/settings/GuestInstructions";
import { tripStatus } from "@/lib/trip-status";

export const instant = false;

type CarRow = Vehicle & { vehicle_images: VehicleImage[] };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-base">
      <span className="text-slate">{label}</span>
      <span className="text-right font-bold">{value}</span>
    </div>
  );
}

export default async function HostCarPage({ params }: PageProps<"/host/vehicles/[vehicleId]">) {
  const { vehicleId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/host/vehicles/${vehicleId}`);

  // Plate and VIN are private columns: read them server-side, scoped to this host.
  const { data } = await createAdminClient()
    .from("vehicles")
    .select("*, vehicle_images(*)")
    .eq("id", vehicleId)
    .eq("host_id", user.id)
    .maybeSingle();
  if (!data) notFound();
  const car = data as unknown as CarRow;

  const [trips, { count: tripRows }, { data: extras }] = await Promise.all([
    loadHostTrips(supabase, user.id, ["pending", "approved", "active", "completed"]),
    supabase.from("trips").select("id", { count: "exact", head: true }).eq("vehicle_id", vehicleId),
    supabase.from("vehicle_extras").select("*").eq("vehicle_id", vehicleId).order("position"),
  ]);
  const carTrips = trips.filter((t) => t.vehicle_id === vehicleId);
  const upcoming = carTrips.filter((t) => isRequest(t) || t.status === "approved" || t.status === "active");
  const paid = carTrips.filter((t) => t.payment_status === "captured" && t.status !== "pending");
  const earned = paid.reduce((sum, t) => sum + hostEarningsCents(t.subtotal_cents), 0);

  const name = `${car.make} ${car.model}`;
  const photos = [...car.vehicle_images].sort((a, b) => a.position - b.position);
  const details = [
    [car.year, car.trim].filter(Boolean).join(" "),
    car.color,
    `plate ${car.license_plate}`,
    car.vin ? `VIN ending ${car.vin.slice(-4)}` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/host/vehicles"
        className="flex items-center gap-2 self-start rounded-[12px] bg-white px-3.5 py-2.5 text-[15px] font-bold transition-colors hover:bg-line"
      >
        <ArrowLeft className="size-[18px]" /> Cars
      </Link>

      <section className="flex flex-wrap items-center gap-5 rounded-[32px] bg-white p-3">
        <CarPhoto
          src={coverUrl(car.vehicle_images)}
          alt={name}
          sizes="360px"
          priority
          className="aspect-[4/3] max-w-full flex-[1_1_260px] rounded-[24px] sm:max-w-[360px]"
        />
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5 p-2">
          <h1 className="headline text-[clamp(40px,5vw,64px)]">{name}</h1>
          <p className="text-base text-slate">{details.join(" · ")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <VehicleStatusToggle vehicleId={car.id} status={car.status} photoCount={photos.length} />
            {car.status === "listed" && (
              <Link href={carPath(car)} className="rounded-[14px] bg-board px-4 py-[13px] text-[15px] font-bold hover:bg-line">
                See it as a guest
              </Link>
            )}
            <Link
              href={`/host/calendar?car=${car.id}`}
              className="rounded-[14px] bg-board px-4 py-[13px] text-[15px] font-bold hover:bg-line"
            >
              Calendar
            </Link>
          </div>
          <div className="figures grid max-w-[460px] grid-cols-3 gap-2">
            <Fact label="Trips" value={paid.length} />
            <Fact label="Earned" value={formatPrice(earned)} />
            <Fact label="Rating" value={car.rating_avg ? `★ ${Number(car.rating_avg).toFixed(1)}` : "None yet"} />
          </div>
        </div>
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
        <section className="flex flex-col gap-3 rounded-[30px] bg-peach p-5 text-ink sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[26px]">Price</h2>
            <VehicleEditDialog
              vehicleId={car.id}
              title="Price"
              note="Trips already booked keep the price they were booked at."
              fields={[
                { column: "daily_rate_cents", label: "Daily rate", value: car.daily_rate_cents, unit: "dollars", min: 1000, max: 100000 },
              ]}
            />
          </div>
          <p className="figures font-display text-[56px] leading-none font-extrabold tracking-[-0.03em]">
            {formatPrice(car.daily_rate_cents)}
            <span className="font-sans text-base font-medium tracking-normal text-peach-ink"> a day</span>
          </p>
          <p className="text-sm text-peach-ink">
            You get {formatPrice(hostEarningsCents(car.daily_rate_cents))} a day after Cascade&apos;s 20% fee.
          </p>
          <div className="figures grid grid-cols-2 gap-2">
            <Fact tone="white" label="Week off" value={`${car.weekly_discount_pct}%`} />
            <Fact tone="white" label="Last minute" value={car.last_minute_boost_pct ? `+${car.last_minute_boost_pct}%` : "Off"} />
          </div>
        </section>

        <section className="flex flex-col gap-3 rounded-[30px] bg-sky p-5 text-ink sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[26px]">Miles</h2>
            <VehicleEditDialog
              vehicleId={car.id}
              title="Miles"
              fields={[
                { column: "distance_included_mi", label: "Included per day", value: car.distance_included_mi, unit: "miles", min: 0, max: 2000 },
                { column: "extra_mile_fee_cents", label: "Each extra mile", value: car.extra_mile_fee_cents, unit: "cents", min: 0, max: 500 },
              ]}
            />
          </div>
          <p className="figures font-display text-[56px] leading-none font-extrabold tracking-[-0.03em]">
            {car.distance_included_mi}
            <span className="font-sans text-base font-medium tracking-normal text-sky-ink"> a day included</span>
          </p>
          <p className="rounded-[14px] bg-white px-3 py-2.5 text-[15px]">
            <span className="font-extrabold">{car.extra_mile_fee_cents}¢</span> for each mile after that
          </p>
        </section>

        <section id="trip-preferences" className="flex scroll-mt-24 flex-col gap-1.5 rounded-[30px] bg-white p-5 sm:p-6">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-[26px]">Rules</h2>
            <Link href="/host/hours" className="rounded-[10px] bg-board px-3 py-2 text-sm font-bold hover:bg-line">
              Edit
            </Link>
          </div>
          <Row label="Trip length" value={`${car.min_trip_days} to ${pluralize(car.max_trip_days, "day")}`} />
          <Row label="Notice" value={car.advance_notice_hours ? pluralize(car.advance_notice_hours, "hour") : "None"} />
          <Row label="Time between trips" value={formatBuffer(car.trip_buffer_hours)} />
          {car.weekend_min_two_days && <Row label="Weekends" value="2-day minimum" />}
          <Row label="Instant book" value={car.instant_book ? "On" : "Off, you approve"} />
          <Row label="Pickup" value={car.location_name} />
        </section>
      </div>

      <div id="pricing" className="scroll-mt-24">
        <PricingDiscounts car={car} />
      </div>

      <CarSettings car={car} />

      <section className="rounded-[30px] bg-white p-5 sm:p-6">
        <ExtrasManager vehicleId={car.id} initialExtras={(extras ?? []) as VehicleExtra[]} />
      </section>

      <GuestInstructions vehicleId={car.id} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4">
        <section className="rounded-[30px] bg-white p-5 sm:p-6">
          <PhotoManager vehicleId={car.id} initialPhotos={car.vehicle_images} />
        </section>

        <section className="flex flex-col gap-3 rounded-[30px] bg-white p-5 sm:p-6">
          <h2 className="text-[26px]">Coming up</h2>
          {upcoming.map((t) => {
            const guest = firstName(t.guest?.full_name);
            const status = tripStatus(t, "host");
            const request = isRequest(t);
            return (
              <Link
                key={t.id}
                href={request ? "/host/trips" : "/host/trips?show=upcoming"}
                className={`flex items-center gap-3 rounded-[18px] p-3.5 transition-colors ${request ? "bg-butter hover:bg-[#ffdf80]" : "bg-board hover:bg-line"}`}
              >
                <Initial name={guest} tone="white" className="size-11 rounded-[14px] text-[18px]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-extrabold">
                    {guest} · {status.label.toLowerCase()}
                  </span>
                  <span className="figures text-sm text-slate">
                    {formatRange(t.starts_at, t.ends_at)} · {formatCurrency(hostEarningsCents(t.subtotal_cents))} to you
                  </span>
                </span>
                <ChevronRight className="size-5 shrink-0" />
              </Link>
            );
          })}
          <p className="rounded-[18px] bg-board p-3.5 text-[15px] text-slate">
            {upcoming.length ? "Nothing else booked." : "Nothing booked yet."}{" "}
            <Link href={`/host/calendar?car=${car.id}`} className="font-bold text-ink hover:text-cobalt">
              Block days
            </Link>{" "}
            you need the car.
          </p>
        </section>
      </div>

      <section className="flex flex-wrap items-center gap-3 rounded-[30px] bg-white px-5 py-5 sm:px-6">
        {tripRows ? (
          <>
            <p className="flex-[1_1_260px] text-[15px] text-slate">
              Done hosting it? Unlisting hides it from search and keeps its trip history. Cars with trips can&apos;t be deleted.
            </p>
            <Tag tone="board" className="text-sm">
              {pluralize(tripRows, "booking")} on record
            </Tag>
          </>
        ) : (
          <>
            <p className="flex-[1_1_260px] text-[15px] text-slate">
              Selling the car, or done hosting it? Unlisting keeps it here. Deleting can&apos;t be undone.
            </p>
            <DeleteVehicleButton vehicleId={car.id} name={name} />
          </>
        )}
      </section>
    </div>
  );
}
