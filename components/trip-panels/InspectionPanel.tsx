import { Camera, Gauge } from "lucide-react";
import { Fact, Tile, TileTitle } from "@/components/kit";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCancelled } from "@/lib/trips";
import { loadGuestChecks } from "@/lib/guest-checks";
import {
  type InspectionKind,
  type InspectionRole,
  type InspectionWithPhotos,
  type MilesSummary,
  inspectionOpen,
  inspectionOpensAt,
  loadInspections,
  tripMiles,
} from "@/lib/inspections";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { PhotoGrid } from "./inspection/PhotoGrid";
import { MyInspection } from "./inspection/MyInspection";

type PanelTrip = {
  guest_id: string;
  host_id: string;
  status: "pending" | "approved" | "active" | "completed" | "cancelled_guest" | "cancelled_host";
  starts_at: string;
  ends_at: string;
  completed_at: string | null;
  distance_included_mi: number;
  unlimited_miles: boolean;
  extra_mile_fee_cents: number;
  vehicle: { fuel_type: string } | null;
  guest: { full_name: string } | null;
  host: { full_name: string } | null;
};

const TITLES: Record<InspectionKind, string> = { pickup: "Check-in", return: "Check-out" };

function firstName(name: string | undefined, fallback: string) {
  return name?.trim().split(/\s+/)[0] || fallback;
}

/** What one side recorded: readings, notes and photos. */
function Recorded({ row, levelLabel, who }: { row: InspectionWithPhotos; levelLabel: string; who: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Fact tone="white" label="Odometer" value={row.odometer_mi != null ? `${row.odometer_mi.toLocaleString("en-US")} mi` : "Not noted"} />
        <Fact tone="white" label={levelLabel} value={row.fuel_pct != null ? `${row.fuel_pct}%` : "Not noted"} />
        <Fact tone="white" label="Recorded" value={formatDateTime(row.created_at)} className="col-span-2 sm:col-span-1" />
      </div>
      {row.notes && <p className="text-[15px] leading-[1.45] whitespace-pre-line">{row.notes}</p>}
      <PhotoGrid photos={row.photoUrls} label={who} />
    </div>
  );
}

function MilesLine({ miles, feeCents }: { miles: MilesSummary; feeCents: number }) {
  const driven = `${miles.driven.toLocaleString("en-US")} mi driven`;
  const text =
    miles.includedMi == null
      ? `${driven}, unlimited miles`
      : `${driven}, ${miles.includedMi.toLocaleString("en-US")} included${miles.overMi > 0 ? `, ${miles.overMi.toLocaleString("en-US")} over` : ""}`;
  return (
    <div className={cn("flex items-center gap-3 rounded-[18px] px-4 py-3", miles.overMi > 0 ? "bg-butter text-butter-ink" : "bg-mint text-mint-ink")}>
      <Gauge className="size-5 shrink-0" strokeWidth={1.75} />
      <div className="flex flex-col">
        <span className="figures text-[16px] font-extrabold">{text}</span>
        {miles.overMi > 0 && (
          <span className="text-[14px]">
            Extra miles are {formatCurrency(feeCents)} each, {formatCurrency(miles.overCents)} in all.
          </span>
        )}
      </div>
    </div>
  );
}

/** Check-in and check-out photos and readings from both sides of a trip. */
export async function InspectionPanel({ tripId, viewer, userId }: { tripId: string; viewer: "guest" | "host"; userId: string }) {
  const { data } = await createAdminClient()
    .from("trips")
    .select(
      "guest_id, host_id, status, starts_at, ends_at, completed_at, distance_included_mi, unlimited_miles, extra_mile_fee_cents, vehicle:vehicles(fuel_type), guest:profiles!guest_id(full_name), host:profiles!host_id(full_name)"
    )
    .eq("id", tripId)
    .maybeSingle();
  const trip = data as unknown as PanelTrip | null;
  if (!trip || (viewer === "guest" ? trip.guest_id : trip.host_id) !== userId) return null;
  if (trip.status === "pending" || isCancelled(trip.status)) return null;

  const now = new Date();
  const rows = await loadInspections(tripId);
  const open = { pickup: inspectionOpen(trip, "pickup", now), return: inspectionOpen(trip, "return", now) };
  if (rows.length === 0 && !open.pickup && !open.return) {
    // Too early, or long over with nothing recorded.
    if (trip.status === "completed") return null;
    return (
      <Tile className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-board">
          <Camera className="size-5" strokeWidth={1.75} />
        </span>
        <p className="text-[15px] leading-[1.4]">
          Check-in opens {formatDateTime(inspectionOpensAt(trip, "pickup"))}. You&apos;ll take a few photos and note the
          odometer and {trip.vehicle?.fuel_type === "electric" ? "charge" : "fuel"}.
        </p>
      </Tile>
    );
  }

  const electric = trip.vehicle?.fuel_type === "electric";
  const levelLabel = electric ? "Charge" : "Fuel";
  const other: InspectionRole = viewer === "guest" ? "host" : "guest";
  const otherName = firstName((other === "guest" ? trip.guest : trip.host)?.full_name, other === "guest" ? "Guest" : "Host");
  const miles = tripMiles(trip, rows);
  const started = now >= new Date(trip.starts_at);
  // The guest's check-in waits for their licence check and cover.
  const locked = viewer === "guest" && open.pickup && !!(await loadGuestChecks(tripId))?.missing.length;
  const kinds = (["pickup", "return"] as const).filter((k) => k === "pickup" || started || rows.some((r) => r.kind === k));

  return (
    <Tile className="flex flex-col gap-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <TileTitle>Check-in and check-out</TileTitle>
        <p className="text-[15px] text-slate">
          Photos and readings at pick-up and return. They settle any question about miles, {levelLabel.toLowerCase()} or damage.
        </p>
      </div>

      {kinds.map((kind) => {
        const mine = rows.find((r) => r.kind === kind && r.role === viewer) ?? null;
        const theirs = rows.find((r) => r.kind === kind && r.role === other) ?? null;
        const when = kind === "pickup" ? trip.starts_at : trip.ends_at;
        return (
          <section key={kind} className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="text-[20px] leading-tight font-extrabold">{TITLES[kind]}</h3>
              <span className="text-[14px] text-slate">
                {kind === "pickup" ? "Pick-up" : "Return"} {formatDateTime(when)}
              </span>
            </div>

            <div className="flex flex-col gap-2.5 rounded-[20px] bg-board p-3.5">
              <span className="text-[15px] font-semibold">You</span>
              {kind === "pickup" && locked && mine ? (
                <Recorded row={mine} levelLabel={levelLabel} who="Your check-in" />
              ) : kind === "pickup" && locked ? (
                <p className="text-[15px] text-slate">
                  Locked until your checks are done.{" "}
                  <a href="#checks" className="font-bold text-cobalt hover:underline">
                    Finish them
                  </a>
                </p>
              ) : open[kind] ? (
                <MyInspection
                  tripId={tripId}
                  kind={kind}
                  electric={electric}
                  existing={
                    mine && {
                      odometer_mi: mine.odometer_mi,
                      fuel_pct: mine.fuel_pct,
                      notes: mine.notes,
                      photoUrls: mine.photoUrls,
                    }
                  }
                >
                  {mine && <Recorded row={mine} levelLabel={levelLabel} who={`Your ${TITLES[kind].toLowerCase()}`} />}
                </MyInspection>
              ) : mine ? (
                <Recorded row={mine} levelLabel={levelLabel} who={`Your ${TITLES[kind].toLowerCase()}`} />
              ) : (
                <p className="text-[15px] text-slate">
                  {now < inspectionOpensAt(trip, kind)
                    ? `Opens ${formatDateTime(inspectionOpensAt(trip, kind))}.`
                    : "Closed. Nothing was recorded."}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2.5 rounded-[20px] bg-board p-3.5">
              <span className="text-[15px] font-semibold">{otherName}</span>
              {theirs ? (
                <Recorded row={theirs} levelLabel={levelLabel} who={`${otherName}'s ${TITLES[kind].toLowerCase()}`} />
              ) : (
                <p className="text-[15px] text-slate">Nothing yet.</p>
              )}
            </div>
          </section>
        );
      })}

      {miles && <MilesLine miles={miles} feeCents={trip.extra_mile_fee_cents} />}
    </Tile>
  );
}
