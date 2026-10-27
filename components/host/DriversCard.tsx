import { ChevronDown } from "lucide-react";
import { Fact, Tag, Tile, TileTitle } from "@/components/kit";
import { Initial, firstName } from "@/components/host/bits";
import { DriverActions } from "@/components/trip-panels/drivers/DriverActions";
import { createAdminClient } from "@/lib/supabase/admin";
import { type DriverRow, DRIVER_STATUS, driverFirstName, driversOpen, loadDrivers } from "@/lib/drivers";
import { ageOn } from "@/lib/pricing";
import { formatDate, toDateKey } from "@/lib/utils";

/**
 * The host's view of a trip's additional drivers, Turo style: a reminder
 * that the primary driver has to be there, then each driver with Approve and
 * Decline. Nothing shows until the guest adds someone.
 */
export async function DriversCard({ tripId, userId }: { tripId: string; userId: string }) {
  const admin = createAdminClient();
  const { data: trip } = await admin
    .from("trips")
    .select("id, host_id, status, starts_at, ends_at, guest:profiles!guest_id(full_name)")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip || trip.host_id !== userId) return null;

  const drivers = await loadDrivers(admin, tripId);
  if (!drivers.length) return null;

  const guest = firstName((trip as unknown as { guest: { full_name: string } | null }).guest?.full_name);
  const open = driversOpen(trip);
  const waiting = drivers.filter((d) => d.status === "pending").length;

  return (
    <Tile id="drivers" className="flex scroll-mt-4 flex-col gap-3 sm:p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <TileTitle>Additional drivers</TileTitle>
        {open && waiting > 0 && <Tag tone="butter">{waiting} waiting on you</Tag>}
      </div>
      <p className="text-[15px] text-slate">
        Additional drivers can&apos;t pick up or return the car without {guest}, the primary driver.
      </p>
      <ul className="flex flex-col">
        {drivers.map((d) => (
          <Driver key={d.id} driver={d} tripId={tripId} open={open} startsAt={trip.starts_at} />
        ))}
      </ul>
    </Tile>
  );
}

function Driver({ driver: d, tripId, open, startsAt }: { driver: DriverRow; tripId: string; open: boolean; startsAt: string }) {
  const status = DRIVER_STATUS[d.status];
  const name = driverFirstName(d.full_name);
  const age = ageOn(d.date_of_birth, new Date(`${toDateKey(startsAt)}T12:00:00Z`));
  const account = d.profile
    ? d.profile.driving_license_verified
      ? "On Cascade, licence checked"
      : "On Cascade"
    : "Not on Cascade";
  const actions = d.status === "pending" ? (["decline", "approve"] as const) : d.status === "approved" ? (["decline"] as const) : (["approve"] as const);

  return (
    <li className="border-t-2 border-ink/10 first:border-t-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 py-3 [&::-webkit-details-marker]:hidden">
          <Initial name={d.full_name} seed={d.email} className="size-11 rounded-[14px] text-[18px]" />
          <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
            <span className="text-[16px] font-bold">{d.full_name}</span>
            <Tag tone={status.tone}>{d.status === "pending" ? "Waiting on you" : status.label}</Tag>
          </span>
          <span className="flex items-center gap-1 text-[15px] font-bold text-cobalt">
            <span className="group-open:hidden">View</span>
            <span className="hidden group-open:inline">Hide</span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" strokeWidth={2.25} />
          </span>
        </summary>
        <div className="grid grid-cols-2 gap-2 pb-3 sm:grid-cols-3">
          <Fact label="Age at pick-up" value={age} />
          <Fact label="Licence" value={`•••• ${d.licence_last4}, ${d.licence_state}`} />
          <Fact label="Licence expires" value={formatDate(`${d.licence_expiry}T12:00:00Z`)} />
          <Fact label="Email" value={<span className="break-all">{d.email}</span>} className="col-span-2" />
          <Fact label="Account" value={account} />
        </div>
        {open && d.status !== "pending" && (
          <div className="pb-3">
            <DriverActions tripId={tripId} driverId={d.id} name={name} actions={[...actions]} />
          </div>
        )}
      </details>
      {open && d.status === "pending" && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 pl-14">
          <span className="text-[14px] text-slate">Added {formatDate(d.created_at, { month: "short", year: undefined })}</span>
          <DriverActions tripId={tripId} driverId={d.id} name={name} actions={[...actions]} />
        </div>
      )}
    </li>
  );
}
