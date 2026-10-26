import { AIRPORT, milesBetween, YOUNG_DRIVER_AGE } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";
import type { Vehicle } from "@/lib/supabase/types";
import { VehicleEditDialog } from "@/components/host/VehicleEditDialog";

// The distance the delivery example uses, e.g. "A 6 mi delivery costs $18".
const SAMPLE_MI = 6;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-base">
      <span className="opacity-75">{label}</span>
      <span className="text-right font-bold">{value}</span>
    </div>
  );
}

/** Delivery, driver age and deposit tiles on the host's car page. */
export function CarSettings({ car }: { car: Vehicle }) {
  const sampleMi = Math.min(SAMPLE_MI, car.delivery_radius_mi);
  const sampleCents = car.delivery_fee_cents + Math.round(sampleMi * car.delivery_fee_per_mi_cents);
  const airportMi = Math.round(milesBetween({ lat: car.location_lat, lng: car.location_lng }, AIRPORT));
  const airportOn = car.airport_delivery_fee_cents != null;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-4">
      <section className="flex flex-col gap-3 rounded-[30px] bg-mint p-5 text-ink sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[26px]">Delivery</h2>
          <VehicleEditDialog
            vehicleId={car.id}
            title="Delivery"
            note="Guests pick a spot when they book and pay the fee with the trip."
            saved="Saved. Trips already booked keep their delivery."
            fields={[
              { kind: "toggle", column: "delivery_enabled", label: "Deliver to guests", value: car.delivery_enabled },
              { column: "delivery_radius_mi", label: "How far you'll go", value: car.delivery_radius_mi, unit: "miles", min: 1, max: 100 },
              { column: "delivery_fee_cents", label: "Base fee", value: car.delivery_fee_cents, unit: "dollars", min: 0, max: 50000 },
              { column: "delivery_fee_per_mi_cents", label: "Plus each mile", value: car.delivery_fee_per_mi_cents, unit: "dollars", min: 0, max: 1000 },
              {
                kind: "optional",
                column: "airport_delivery_fee_cents",
                toggleLabel: "Deliver to Sea-Tac",
                label: "Airport fee",
                value: car.airport_delivery_fee_cents,
                unit: "dollars",
                min: 0,
                max: 50000,
              },
            ]}
          />
        </div>
        {car.delivery_enabled ? (
          <>
            <p className="figures font-display text-[56px] leading-none font-extrabold tracking-[-0.03em]">
              {car.delivery_radius_mi}
              <span className="font-sans text-base font-medium tracking-normal text-mint-ink"> mi around you</span>
            </p>
            <p className="rounded-[14px] bg-white px-3 py-2.5 text-[15px]">
              A {sampleMi} mi delivery costs <span className="figures font-extrabold">{formatPrice(sampleCents)}</span>
            </p>
          </>
        ) : (
          <p className="text-[15px] text-mint-ink">Off. Guests pick the car up at {car.location_name}.</p>
        )}
        <div className="flex flex-col">
          {car.delivery_enabled && (
            <Row
              label="Fee"
              value={`${formatPrice(car.delivery_fee_cents)} + ${formatPrice(car.delivery_fee_per_mi_cents)}/mi`}
            />
          )}
          <Row label={`Sea-Tac, ${airportMi} mi`} value={airportOn ? formatPrice(car.airport_delivery_fee_cents!) : "Off"} />
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-[30px] bg-lilac p-5 text-ink sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[26px]">Drivers</h2>
          <VehicleEditDialog
            vehicleId={car.id}
            title="Drivers"
            note={`Drivers under ${YOUNG_DRIVER_AGE} pay the young driver fee each day of the trip.`}
            saved="Saved. Trips already booked keep their terms."
            fields={[
              { column: "min_age", label: "Youngest driver", value: car.min_age, unit: "years", min: 18, max: 30 },
              { column: "young_driver_fee_cents", label: `Fee a day for under ${YOUNG_DRIVER_AGE}s`, value: car.young_driver_fee_cents, unit: "dollars", min: 0, max: 10000 },
            ]}
          />
        </div>
        <p className="figures font-display text-[56px] leading-none font-extrabold tracking-[-0.03em]">
          {car.min_age}+
          <span className="font-sans text-base font-medium tracking-normal text-lilac-ink"> years old to drive</span>
        </p>
        <p className="rounded-[14px] bg-white px-3 py-2.5 text-[15px]">
          {car.min_age >= YOUNG_DRIVER_AGE ? (
            <>No young driver fee, since every driver is {YOUNG_DRIVER_AGE} or older.</>
          ) : car.young_driver_fee_cents ? (
            <>
              Under {YOUNG_DRIVER_AGE}s pay <span className="figures font-extrabold">{formatPrice(car.young_driver_fee_cents)}</span> a day
              on top
            </>
          ) : (
            <>No extra fee for drivers under {YOUNG_DRIVER_AGE}</>
          )}
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-[30px] bg-butter p-5 text-ink sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[26px]">Deposit</h2>
          <VehicleEditDialog
            vehicleId={car.id}
            title="Security deposit"
            note="Set 0 for no deposit. Trips already booked keep theirs."
            saved="Saved. Trips already booked keep their deposit."
            fields={[{ column: "deposit_cents", label: "Deposit", value: car.deposit_cents, unit: "dollars", min: 0, max: 500000 }]}
          />
        </div>
        <p className="figures font-display text-[56px] leading-none font-extrabold tracking-[-0.03em]">
          {car.deposit_cents ? formatPrice(car.deposit_cents) : "None"}
        </p>
        <p className="text-[15px] text-butter-ink">
          {car.deposit_cents
            ? "A hold on the guest's card at pick-up, released after the car is back. Post-trip charges can come out of it."
            : "No hold on the guest's card. Set one and it's held at pick-up, then released after the car is back."}
        </p>
      </section>
    </div>
  );
}
