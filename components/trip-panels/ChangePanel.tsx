import { CalendarClock } from "lucide-react";
import { Fact, PriceRow, Tile, TileTitle } from "@/components/kit";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHANGEABLE_STATUSES, type ChangePricing, otherRanges, quoteSummary } from "@/lib/trip-changes";
import { formatCurrency, formatDateTime, formatTime, pluralize, toDateKey } from "@/lib/utils";
import { tripDays } from "@/lib/pricing";
import { ChangeForm } from "./change/ChangeForm";
import { ChangeActions } from "./change/ChangeActions";

const first = (name: string | null | undefined, fallback: string) => name?.trim().split(/\s+/)[0] || fallback;

/** Old and new times side by side. */
function Compare({
  change,
}: {
  change: { old_starts_at: string; old_ends_at: string; new_starts_at: string; new_ends_at: string };
}) {
  const moved = (a: string, b: string) => new Date(a).getTime() !== new Date(b).getTime();
  return (
    <div className="grid grid-cols-2 gap-2">
      <Fact label="Now" value={<Times from={change.old_starts_at} to={change.old_ends_at} />} />
      <Fact
        tone="white"
        label="Asked for"
        value={
          <Times
            from={change.new_starts_at}
            to={change.new_ends_at}
            fromMoved={moved(change.new_starts_at, change.old_starts_at)}
            toMoved={moved(change.new_ends_at, change.old_ends_at)}
          />
        }
      />
    </div>
  );
}

function Times({ from, to, fromMoved, toMoved }: { from: string; to: string; fromMoved?: boolean; toMoved?: boolean }) {
  return (
    <span className="flex flex-col">
      <span className={fromMoved ? "text-cobalt" : undefined}>{formatDateTime(from)}</span>
      <span className={toMoved ? "text-cobalt" : undefined}>{formatDateTime(to)}</span>
      <span className="text-[13px] font-semibold opacity-75">{pluralize(tripDays(from, to), "day")}</span>
    </span>
  );
}

/** Extending, shortening or moving a trip: the guest asks, the host answers. */
export async function ChangePanel({ tripId, viewer, userId }: { tripId: string; viewer: "guest" | "host"; userId: string }) {
  const admin = createAdminClient();
  const { data: trip } = await admin
    .from("trips")
    .select(
      "id, vehicle_id, guest_id, host_id, status, payment_status, starts_at, ends_at, total_cents, rate_type, guest:profiles!guest_id(full_name), host:profiles!host_id(full_name)"
    )
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return null;
  if ((viewer === "guest" ? trip.guest_id : trip.host_id) !== userId) return null;

  const { data: open } = await admin
    .from("trip_changes")
    .select("*")
    .eq("trip_id", tripId)
    .eq("status", "requested")
    .maybeSingle();

  const names = trip as unknown as { guest: { full_name: string } | null; host: { full_name: string } | null };
  const guest = first(names.guest?.full_name, "Your guest");
  const host = first(names.host?.full_name, "your host");

  if (open) {
    const pricing = open.pricing as unknown as ChangePricing;
    const diff = open.difference_cents;
    const money = (
      <div className="flex flex-col gap-1.5 rounded-[16px] bg-white px-3.5 py-3 text-ink">
        <PriceRow label="New total" value={formatCurrency(pricing.totalCents)} />
        <PriceRow
          strong
          label={diff > 0 ? (viewer === "guest" ? "You pay" : "Guest pays") : diff < 0 ? (viewer === "guest" ? "You get back" : "Guest gets back") : "Difference"}
          value={formatCurrency(Math.abs(diff))}
        />
      </div>
    );

    if (viewer === "host") {
      return (
        <Tile tone="butter" className="flex flex-col gap-3">
          <TileTitle>{guest} wants to change the trip</TileTitle>
          <Compare change={open} />
          {money}
          <p className="text-[15px] leading-[1.45]">
            {diff > 0
              ? `Accepting charges ${guest}'s card ${formatCurrency(diff)}.`
              : diff < 0
                ? `Accepting refunds ${guest} ${formatCurrency(-diff)}.`
                : pricing.refunds === false
                  ? "It's past free cancellation, so the price stays the same."
                  : "The price stays the same."}
          </p>
          <ChangeActions tripId={tripId} changeId={open.id} viewer="host" />
        </Tile>
      );
    }

    return (
      <Tile tone="butter" className="flex flex-col gap-3">
        <TileTitle>Waiting on {host}</TileTitle>
        <Compare change={open} />
        {money}
        <p className="text-[15px] leading-[1.45]">
          {quoteSummary(pricing, diff)} Until then your trip stays as it is.
        </p>
        <ChangeActions tripId={tripId} changeId={open.id} viewer="guest" />
      </Tile>
    );
  }

  const now = new Date();
  const changeable =
    viewer === "guest" &&
    CHANGEABLE_STATUSES.includes(trip.status) &&
    trip.payment_status === "captured" &&
    new Date(trip.ends_at) > now;
  if (!changeable) return null;

  const started = trip.status === "active" || new Date(trip.starts_at) <= now;
  const ranges = await otherRanges(trip);

  return (
    <Tile className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-board">
          <CalendarClock className="size-5" strokeWidth={1.75} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[17px] font-bold">{started ? "Need more time?" : "Plans changed?"}</span>
          <span className="text-[15px] text-slate">
            {started ? `Ask ${host} to move your return.` : `Ask ${host} for different pick-up or return times.`}
          </span>
        </div>
      </div>
      <ChangeForm
        tripId={tripId}
        started={started}
        from={toDateKey(trip.starts_at)}
        until={toDateKey(trip.ends_at)}
        fromTime={formatTime(trip.starts_at)}
        untilTime={formatTime(trip.ends_at)}
        ranges={ranges}
        host={host}
      />
    </Tile>
  );
}
