import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { OPEN_CLAIM_STATUSES } from "@/lib/claims";
import { createAdminClient } from "@/lib/supabase/admin";
import { NO_INDEX } from "@/lib/site";
import { formatCurrency, formatDateTime, formatRange } from "@/lib/utils";
import type { Trip, TripClaim } from "@/lib/supabase/types";
import { EmptyState, Fact, PageTitle, Tag, Tile, TileTitle } from "@/components/kit";
import { CLAIM_STATUS, type ClaimCharge, claimAmount } from "@/components/trip-panels/claims/status";
import { emailsFor, requireAdminPage, signedPhotos } from "../_lib/admin";
import { FilterLinks, Photos } from "../_components/bits";
import { ResolveClaim } from "./resolve-claim";

export const instant = false;
export const metadata = { title: "Claims", ...NO_INDEX };

const FILTERS = {
  escalated: { label: "Escalated", statuses: ["escalated"] },
  open: { label: "All open", statuses: OPEN_CLAIM_STATUSES },
  closed: { label: "Settled", statuses: ["resolved", "closed"] },
} as const;
type Filter = keyof typeof FILTERS;

type ClaimRow = TripClaim & {
  trip: Pick<Trip, "id" | "starts_at" | "ends_at"> | null;
  vehicle: { make: string; model: string; year: number } | null;
  guest: { full_name: string } | null;
  host: { full_name: string } | null;
  charge: ClaimCharge | null;
};

export default async function AdminClaimsPage({ searchParams }: PageProps<"/host/admin/claims">) {
  await requireAdminPage("/host/admin/claims");
  const sp = await searchParams;
  const filter: Filter = typeof sp.status === "string" && sp.status in FILTERS ? (sp.status as Filter) : "escalated";

  const { data } = await createAdminClient()
    .from("trip_claims")
    .select(
      "*, trip:trips(id, starts_at, ends_at), vehicle:vehicles(make, model, year), guest:profiles!guest_id(full_name), host:profiles!host_id(full_name), charge:trip_charges(id, status, amount_cents, created_at)"
    )
    .in("status", [...FILTERS[filter].statuses])
    .order("created_at", { ascending: filter === "closed" ? false : true })
    .limit(50);
  const claims = (data ?? []) as unknown as ClaimRow[];

  const [emails, urls] = await Promise.all([
    emailsFor(claims.flatMap((c) => [c.guest_id, c.host_id])),
    signedPhotos(claims.flatMap((c) => c.photos)),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4">
      <PageTitle title="Claims" lead="Damage claims hosts sent to Cascade. Record an outcome. This moves no money." />
      <FilterLinks
        current={filter}
        options={Object.entries(FILTERS).map(([value, f]) => ({
          value,
          label: f.label,
          href: value === "escalated" ? "/host/admin/claims" : `/host/admin/claims?status=${value}`,
        }))}
      />

      {claims.length === 0 && <EmptyState icon={<ShieldAlert />} title="Nothing here." body="No claims in this list right now." />}

      {claims.map((c) => {
        const status = CLAIM_STATUS[c.status];
        const car = c.vehicle ? `${c.vehicle.year} ${c.vehicle.make} ${c.vehicle.model}` : "Car";
        const open = OPEN_CLAIM_STATUSES.includes(c.status);
        const amount = claimAmount(c, c.charge);
        return (
          <Tile key={c.id} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <TileTitle>
                  Damage{amount != null ? ` · ${formatCurrency(amount)}` : ""}
                </TileTitle>
                <Link href={`/host/admin/trips/${c.trip_id}`} className="text-[15px] font-semibold text-slate hover:text-cobalt">
                  {car}
                  {c.trip ? `, ${formatRange(c.trip.starts_at, c.trip.ends_at)}` : ""}
                </Link>
              </div>
              <span className="flex flex-wrap gap-2">
                {c.reported_late && <Tag>Reported late</Tag>}
                <Tag tone={status.tone}>{status.label}</Tag>
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Fact label="Host" value={`${c.host?.full_name ?? "Host"} · ${emails[c.host_id] ?? ""}`} />
              <Fact label="Guest" value={`${c.guest?.full_name ?? "Guest"} · ${emails[c.guest_id] ?? ""}`} />
              <Fact label="Happened" value={formatDateTime(c.incident_at)} />
              <Fact label="Reported" value={`${formatDateTime(c.created_at)}, by the ${c.reported_by}`} />
              {c.escalated_at && <Fact label="Escalated" value={formatDateTime(c.escalated_at)} />}
              {c.documents_due_at && <Fact label="Documents due" value={formatDateTime(c.documents_due_at)} />}
              {c.charge && <Fact label="Linked charge" value={`${formatCurrency(c.charge.amount_cents)}, ${c.charge.status}`} />}
            </div>

            <div className="flex flex-col gap-1.5 rounded-[16px] bg-board px-4 py-3">
              <span className="text-[13px] font-bold text-slate">The report</span>
              <p className="text-[15px] whitespace-pre-wrap">{c.description}</p>
            </div>
            {c.resolution_note && (
              <div className="flex flex-col gap-1.5 rounded-[16px] bg-mint px-4 py-3 text-mint-ink">
                <span className="text-[13px] font-bold">Note</span>
                <p className="text-[15px] whitespace-pre-wrap">{c.resolution_note}</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold text-slate">Photos and documents</span>
              <Photos paths={c.photos} urls={urls} />
            </div>

            {open && <ResolveClaim claimId={c.id} />}
          </Tile>
        );
      })}
    </div>
  );
}
