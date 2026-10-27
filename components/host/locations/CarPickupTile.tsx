import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACCESS_LABEL, feeLabel, freeRule, loadLocations, spotFor } from "@/lib/locations";
import { HOST_SHARE } from "@/lib/pricing";
import type { Vehicle } from "@/lib/supabase/types";
import { pluralize } from "@/lib/utils";
import { KIND_ICON } from "./icons";
import { SpotSwitch } from "./SpotSwitch";

function Heading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[12px] font-bold tracking-[0.06em] text-mint-ink uppercase">{children}</h3>;
}

/** The car page's pickup and delivery tile: its home spot, the host's spots, and the custom radius. */
export async function CarPickupTile({ car }: { car: Vehicle }) {
  const admin = createAdminClient();
  const [locations, { data: fleet }] = await Promise.all([
    loadLocations(admin, car.host_id),
    admin.from("vehicles").select("id").eq("host_id", car.host_id),
  ]);
  const others = (fleet ?? []).map((v) => v.id).filter((id) => id !== car.id);
  const spots = locations.filter((l) => l.kind !== "custom");
  const custom = locations.find((l) => l.kind === "custom");
  const offered = locations.filter((l) => l.enabled && spotFor(l, car.id).on).length;

  const row = (l: (typeof locations)[number]) => {
    const Icon = KIND_ICON[l.kind];
    const { on, fee_cents } = spotFor(l, car.id);
    const price = feeLabel({ ...l, fee_cents });
    return (
      <li key={l.id} className="flex items-center gap-3 rounded-[16px] bg-white/70 px-3 py-2.5">
        <Icon className="size-5 shrink-0" strokeWidth={1.75} />
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] leading-snug font-bold">
            {l.kind === "custom" ? `Guest's address, up to ${pluralize(l.radius_mi ?? 0, "mile")}` : l.name}
          </span>
          <span className="block text-[13px] text-mint-ink">
            {[
              price === "Free" ? "Free delivery" : `${price} delivery`,
              freeRule(l),
              l.kind === "custom" ? null : ACCESS_LABEL[l.vehicle_access],
              l.enabled ? null : "Off for all cars",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        {l.enabled && (
          <SpotSwitch locationId={l.id} vehicleId={car.id} name={l.kind === "custom" ? "Delivery" : l.name} on={on} allCars={l.all_vehicles} otherCarIds={others} />
        )}
      </li>
    );
  };

  return (
    <section className="flex flex-col gap-4 rounded-[30px] bg-mint p-5 text-ink sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[26px]">Pickup and delivery</h2>
        <Link href="/host/locations" className="rounded-[10px] bg-white px-3 py-2 text-sm font-bold hover:bg-line">
          Locations
        </Link>
      </div>
      <div className="grid gap-x-5 gap-y-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <p className="figures font-display text-[56px] leading-none font-extrabold tracking-[-0.03em]">
            {offered + 1}
            <span className="font-sans text-base font-medium tracking-normal text-mint-ink">
              {" "}
              {offered ? "ways to get this car" : "spot, its home"}
            </span>
          </p>
          <Heading>Home location</Heading>
          <p className="rounded-[16px] bg-white px-3 py-2.5 text-[15px]">
            <span className="block font-bold">{car.location_address || car.location_name}</span>
            <span className="text-[13px] text-mint-ink">Pick-up and return here is free.</span>
          </p>
          <p className="text-[13px] text-mint-ink">
            Fees cover drop-off and pick-up. You get {Math.round(HOST_SHARE * 100)}% of them.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <Heading>Delivery locations</Heading>
          {spots.length > 0 ? (
            <ul className="flex flex-col gap-1.5">{spots.map(row)}</ul>
          ) : (
            <p className="text-[15px] text-mint-ink">
              None yet. Add the airport or a hotel nearby on Locations and guests can pick it when they book.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-3">
          <Heading>Custom location</Heading>
          {custom ? (
            <ul className="flex flex-col gap-1.5">{row(custom)}</ul>
          ) : (
            <p className="text-[15px] text-mint-ink">
              Off. Turn on delivery to guests&apos; addresses on Locations, with a radius and a fee.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
