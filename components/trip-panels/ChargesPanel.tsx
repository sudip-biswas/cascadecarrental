import { Fact, Tag, Tile, TileTitle } from "@/components/kit";
import { createAdminClient } from "@/lib/supabase/admin";
import { chargeWindow } from "@/lib/charges";
import { INSPECTION_BUCKET, milesDriven } from "@/lib/inspections";
import type { Trip, TripCharge } from "@/lib/supabase/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { PhotoGrid } from "./inspection/PhotoGrid";
import { CancelChargeButton, GuestChargeActions } from "./charges/ChargeActions";
import { RequestChargeForm } from "./charges/RequestChargeForm";
import { chargeStatus, kindLabel } from "./charges/kinds";

/** How long a photo link works. */
const SIGNED_URL_SECONDS = 60 * 60;
const AUTO_CHARGE_MS = 3 * 86_400_000;

type PanelTrip = Pick<Trip, "id" | "guest_id" | "host_id" | "status" | "ends_at" | "deposit_cents" | "deposit_status">;

function depositLine(trip: PanelTrip, viewer: "guest" | "host") {
  const amount = formatCurrency(trip.deposit_cents);
  switch (trip.deposit_status) {
    case "held":
      return viewer === "guest"
        ? `${amount} is held on your card, not charged. It's released about 2 days after the trip if nothing is owed.`
        : `${amount} is held on the guest's card until about 2 days after the trip.`;
    case "released":
      return `The ${amount} hold is released.`;
    case "captured":
      return "Part of the deposit paid a charge. The rest of the hold is released.";
    case "failed":
      return viewer === "guest"
        ? "We couldn't place the deposit hold on your card."
        : "The deposit hold didn't go through. Charges go to the guest's card instead.";
    default:
      return null;
  }
}

function ChargeRow({
  charge,
  viewer,
  photos,
}: {
  charge: TripCharge;
  viewer: "guest" | "host";
  photos: { path: string; url: string | null }[];
}) {
  const status = chargeStatus(charge, viewer);
  const owed = charge.status === "requested" || charge.status === "failed";

  return (
    <li className="flex flex-col gap-2.5 rounded-[20px] bg-board p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className="text-[17px] font-extrabold">{kindLabel(charge.kind)}</span>
          <Tag tone={status.tone === "board" ? "white" : status.tone}>{status.label}</Tag>
        </span>
        <span className="figures font-display text-[22px] font-extrabold">{formatCurrency(charge.amount_cents)}</span>
      </div>
      <p className="text-[15px] leading-[1.45] whitespace-pre-line">{charge.description}</p>
      <PhotoGrid photos={photos} label={kindLabel(charge.kind)} />

      {charge.status === "requested" && (
        <p className="text-[14px] text-slate">
          {viewer === "guest"
            ? `Pay it or dispute it. If you don't answer by ${formatDateTime(new Date(new Date(charge.created_at).getTime() + AUTO_CHARGE_MS))}, it's charged to your card.`
            : `Sent ${formatDateTime(charge.created_at)}. It's charged automatically if the guest doesn't answer in 3 days.`}
        </p>
      )}
      {charge.status === "failed" && charge.failure_reason && (
        <p className="rounded-[14px] bg-peach px-3.5 py-2.5 text-[14px] font-semibold text-peach-ink">{charge.failure_reason}</p>
      )}
      {charge.status === "disputed" && (
        <p className="text-[14px] text-slate">
          {viewer === "guest" ? "You disputed this. Cascade is looking at it." : "The guest disputed this. Cascade is looking at it."}
          {charge.guest_note && <span className="mt-1 block text-ink">&ldquo;{charge.guest_note}&rdquo;</span>}
        </p>
      )}
      {charge.resolution_note && (
        <p className="text-[14px] text-slate">
          Cascade: <span className="text-ink">{charge.resolution_note}</span>
        </p>
      )}

      {viewer === "guest" && (owed || charge.status === "disputed") && (
        <GuestChargeActions
          tripId={charge.trip_id}
          chargeId={charge.id}
          amountCents={charge.amount_cents}
          canDispute={owed}
        />
      )}
      {viewer === "host" && (owed || charge.status === "disputed") && (
        <CancelChargeButton tripId={charge.trip_id} chargeId={charge.id} />
      )}
    </li>
  );
}

/** Charges after a trip and the deposit hold, for whichever side is looking. */
export async function ChargesPanel({ tripId, viewer, userId }: { tripId: string; viewer: "guest" | "host"; userId: string }) {
  const admin = createAdminClient();
  const [{ data: trip }, { data: rows }] = await Promise.all([
    admin
      .from("trips")
      .select("id, guest_id, host_id, status, ends_at, deposit_cents, deposit_status, extra_mile_fee_cents")
      .eq("id", tripId)
      .maybeSingle(),
    admin.from("trip_charges").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }),
  ]);
  if (!trip || (viewer === "guest" ? trip.guest_id : trip.host_id) !== userId) return null;

  const charges = rows ?? [];
  const window = chargeWindow(trip);
  const canRequest = viewer === "host" && window.open;
  const deposit = trip.deposit_cents > 0 ? depositLine(trip, viewer) : null;
  if (!charges.length && !canRequest && !deposit) return null;

  const summary = canRequest && !window.activeOnly ? await milesDriven(tripId) : null;
  const miles = summary && { ...summary, feeCents: trip.extra_mile_fee_cents };

  const paths = charges.flatMap((c) => c.photos);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await admin.storage.from(INSPECTION_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const s of data ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  return (
    <Tile className="flex flex-col gap-3.5 sm:p-6">
      <TileTitle>{viewer === "guest" ? "Charges and deposit" : "Charges"}</TileTitle>

      {canRequest && (
        <p className="text-[15px] text-slate">
          {window.activeOnly
            ? "During the trip you can send tolls. Fuel, extra miles, cleaning and the rest can go once it's done."
            : `Extra miles, fuel, tolls or cleaning? You can send charges until ${formatDateTime(window.closesAt)}. You get all of it.`}
        </p>
      )}
      {canRequest && <RequestChargeForm tripId={tripId} tollsOnly={window.activeOnly} miles={miles} />}

      {deposit && <Fact label="Security deposit" value={deposit} />}

      {charges.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {charges.map((c) => (
            <ChargeRow
              key={c.id}
              charge={c}
              viewer={viewer}
              photos={c.photos.map((path) => ({ path, url: urls.get(path) ?? null }))}
            />
          ))}
        </ul>
      )}
    </Tile>
  );
}
