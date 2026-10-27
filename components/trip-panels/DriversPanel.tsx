import { Tag, Tile, TileTitle } from "@/components/kit";
import { Initial } from "@/components/host/bits";
import { createAdminClient } from "@/lib/supabase/admin";
import { DRIVER_STATUS, MAX_DRIVERS, driverFirstName, driversOpen, loadDrivers } from "@/lib/drivers";
import { toDateKey } from "@/lib/utils";
import { DriverForm } from "./drivers/DriverForm";
import { DriverActions } from "./drivers/DriverActions";

const first = (name: string | null | undefined, fallback: string) => name?.trim().split(/\s+/)[0] || fallback;

/** The guest's additional drivers: add someone after booking, see if the host approved, take them off. */
export async function DriversPanel({ tripId, userId }: { tripId: string; userId: string }) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("trips")
    .select("id, guest_id, status, starts_at, ends_at, host:profiles!host_id(full_name), vehicle:vehicles(min_age)")
    .eq("id", tripId)
    .maybeSingle();
  const trip = data as unknown as {
    id: string;
    guest_id: string;
    status: "pending" | "approved" | "active" | "completed" | "cancelled_guest" | "cancelled_host";
    starts_at: string;
    ends_at: string;
    host: { full_name: string } | null;
    vehicle: { min_age: number } | null;
  } | null;
  if (!trip || trip.guest_id !== userId) return null;
  if (trip.status === "cancelled_guest" || trip.status === "cancelled_host") return null;

  const open = driversOpen(trip);
  // Once the trip is over, only the people who could drive are worth showing.
  const drivers = (await loadDrivers(admin, tripId)).filter((d) => open || d.status === "approved");
  if (!open && !drivers.length) return null;

  const host = first(trip.host?.full_name, "your host");
  const live = drivers.filter((d) => d.status === "pending" || d.status === "approved").length;

  return (
    <Tile id="drivers" className="flex scroll-mt-4 flex-col gap-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <TileTitle>Additional drivers</TileTitle>
        <p className="text-[15px] text-slate">
          {open
            ? `Anyone else who'll drive has to be added here and approved by ${host}. You still have to be there for pick-up and return.`
            : "Who else could drive on this trip."}
        </p>
      </div>

      {drivers.length > 0 && (
        <ul className="flex flex-col gap-2">
          {drivers.map((d) => {
            const status = DRIVER_STATUS[d.status];
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 rounded-[20px] bg-board p-3 pr-4">
                <Initial name={d.full_name} seed={d.email} className="size-11 rounded-[14px] text-[18px]" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[16px] font-bold">{d.full_name}</span>
                  <span className="text-[14px] text-slate">
                    Licence •••• {d.licence_last4} · {d.licence_state}
                  </span>
                </span>
                <Tag tone={status.tone === "board" ? "white" : status.tone}>
                  {d.status === "pending" ? `Waiting on ${host}` : status.label}
                </Tag>
                {open && (d.status === "pending" || d.status === "approved") && (
                  <DriverActions tripId={tripId} driverId={d.id} name={driverFirstName(d.full_name)} actions={["remove"]} />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {open &&
        (live < MAX_DRIVERS ? (
          <DriverForm
            tripId={tripId}
            host={host}
            minAge={trip.vehicle?.min_age ?? 18}
            until={toDateKey(trip.ends_at)}
          />
        ) : (
          <p className="text-[15px] text-slate">That&apos;s the most a trip can have. Remove someone to add another.</p>
        ))}

      {open && drivers.some((d) => d.status === "declined") && (
        <p className="text-[14px] text-slate">
          Declined drivers can&apos;t drive the car. Message {host} if you&apos;re not sure why.
        </p>
      )}
    </Tile>
  );
}
