import Link from "next/link";
import { Fact, Tag, Tile, TileTitle } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { CLAIM_WINDOW_DAYS, chargeWindow, claimClosesAt } from "@/lib/charge-windows";
import { type ClaimTrip, CLAIM_TRIP_SELECT, claimWindow, isOpenClaim } from "@/lib/claims";
import { INSPECTION_BUCKET } from "@/lib/inspections";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TripClaim } from "@/lib/supabase/types";
import { formatCurrency, formatDateTime, formatTime, toDateKey } from "@/lib/utils";
import { ClaimActions } from "./claims/ClaimActions";
import { ReportClaimForm } from "./claims/ReportClaimForm";
import { CLAIM_STATUS, type ClaimCharge, claimAmount, hostNextStep } from "./claims/status";
import { PhotoGrid } from "./inspection/PhotoGrid";

const SIGNED_URL_SECONDS = 60 * 60;
const DAY_MS = 86_400_000;

type ClaimRow = TripClaim & { charge: ClaimCharge | null };

function ClaimCard({
  claim,
  trip,
  viewer,
  photos,
}: {
  claim: ClaimRow;
  trip: ClaimTrip;
  viewer: "guest" | "host";
  photos: { path: string; url: string | null }[];
}) {
  const status = CLAIM_STATUS[claim.status];
  const open = isOpenClaim(claim);
  const amount = claimAmount(claim, claim.charge);
  const next = viewer === "host" && open ? hostNextStep(claim, trip, claim.charge) : null;
  const charging = chargeWindow(trip, "damage", { linkedToClaim: true }).open;
  const inWindow = new Date() < claimClosesAt(trip);

  return (
    <li className="flex flex-col gap-2.5 rounded-[20px] bg-board p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[17px] font-extrabold">Damage reported by the {claim.reported_by}</span>
          <Tag tone={status.tone === "board" ? "white" : status.tone}>{status.label}</Tag>
          {claim.reported_late && <Tag tone="white">Reported late</Tag>}
        </span>
        {amount != null && <span className="figures font-display text-[22px] font-extrabold">{formatCurrency(amount)}</span>}
      </div>
      <p className="text-[14px] text-slate">Happened {formatDateTime(claim.incident_at)}</p>
      <p className="text-[15px] leading-[1.45] whitespace-pre-line">{claim.description}</p>
      <PhotoGrid photos={photos} label="Damage" />

      {next && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Fact tone="white" label="Next" value={next.action} />
          {next.deadline && <Fact tone="white" label={next.deadlineLabel} value={formatDateTime(next.deadline)} />}
        </div>
      )}
      {viewer === "guest" && open && (
        <p className="text-[14px] text-slate">
          {claim.status === "with_guest" || claim.status === "disputed"
            ? "There's a charge linked to this claim. See Charges and deposit below."
            : claim.status === "escalated"
              ? "Cascade is looking at both sides."
              : "Nothing to pay right now."}
        </p>
      )}
      {claim.resolution_note && (
        <p className="text-[14px] text-slate">
          Note: <span className="text-ink">{claim.resolution_note}</span>
        </p>
      )}

      {viewer === "host" && (
        <ClaimActions
          tripId={claim.trip_id}
          claimId={claim.id}
          estimateCents={claim.estimate_cents}
          description={claim.description}
          canAsk={claim.status === "reported" && charging && claim.charge?.status !== "declined"}
          canEscalate={inWindow && ["reported", "with_guest", "disputed"].includes(claim.status)}
          canClose={claim.status === "reported"}
          canAddDocuments={open}
        />
      )}
    </li>
  );
}

/** Damage on a trip: how to report it, and where each claim stands, for whichever side is looking. */
export async function ClaimsPanel({
  tripId,
  viewer,
  userId,
  report = false,
}: {
  tripId: string;
  viewer: "guest" | "host";
  userId: string;
  /** Came from the incident card: the form starts open. */
  report?: boolean;
}) {
  const admin = createAdminClient();
  const [{ data }, { data: rows }] = await Promise.all([
    admin.from("trips").select(CLAIM_TRIP_SELECT).eq("id", tripId).maybeSingle(),
    admin
      .from("trip_claims")
      .select("*, charge:trip_charges(id, status, amount_cents, created_at)")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false }),
  ]);
  const trip = data as ClaimTrip | null;
  if (!trip || (viewer === "guest" ? trip.guest_id : trip.host_id) !== userId) return null;

  const claims = (rows ?? []) as unknown as ClaimRow[];
  const now = new Date();
  const window = claimWindow(trip, now);
  const canReport = window.open && !claims.some(isOpenClaim);
  const hasCard = trip.status === "approved" || trip.status === "active";
  if (!claims.length && !canReport && !hasCard) return null;

  const paths = claims.flatMap((c) => c.photos);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data: signed } = await admin.storage.from(INSPECTION_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
    for (const s of signed ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
  }

  const lastDay = new Date(Math.min(now.getTime(), new Date(trip.ends_at).getTime() + DAY_MS));
  const pastDue = viewer === "host" && now.getTime() > new Date(trip.ends_at).getTime() + DAY_MS;

  return (
    <Tile id="claim" className="flex scroll-mt-4 flex-col gap-3.5 sm:p-6">
      <TileTitle>Damage or an accident</TileTitle>

      {canReport && (
        <p className="text-[15px] text-slate">
          {viewer === "guest"
            ? `Report within 24 hours of it happening, by ${formatDateTime(window.closesAt)} at the latest.`
            : pastDue
              ? `Past the 24 hours, so this report is marked late. You can report until ${formatDateTime(window.closesAt)}.`
              : `Report within 24 hours of the trip ending. Later reports are marked late, up to ${CLAIM_WINDOW_DAYS} days after.`}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {canReport && (
          <ReportClaimForm
            // Next keeps a visited page's state, so arriving from the card needs a fresh form.
            key={report ? "from-card" : "closed"}
            tripId={trip.id}
            viewer={viewer}
            defaultDate={toDateKey(lastDay)}
            defaultTime={formatTime(lastDay)}
            minDate={toDateKey(new Date(new Date(trip.starts_at).getTime() - DAY_MS))}
            maxDate={toDateKey(lastDay)}
            startOpen={report}
          />
        )}
        {hasCard && (
          <Button asChild variant="outline">
            <Link href={`/trips/${trip.id}/incident-card`}>Incident card</Link>
          </Button>
        )}
      </div>

      {claims.length > 0 && (
        <ul className="flex flex-col gap-2.5">
          {claims.map((c) => (
            <ClaimCard
              key={c.id}
              claim={c}
              trip={trip}
              viewer={viewer}
              photos={c.photos.map((path) => ({ path, url: urls.get(path) ?? null }))}
            />
          ))}
        </ul>
      )}
    </Tile>
  );
}
