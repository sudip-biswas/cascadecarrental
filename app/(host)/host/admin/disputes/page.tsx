import Link from "next/link";
import { Gavel } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { NO_INDEX } from "@/lib/site";
import { formatCurrency, formatDateTime, formatRange } from "@/lib/utils";
import type { TripCharge, TripInspection } from "@/lib/supabase/types";
import { EmptyState, Fact, PageTitle, Tag, Tile, TileTitle, type Tone } from "@/components/kit";
import { emailsFor, requireAdminPage, signedPhotos } from "../_lib/admin";
import { FilterLinks, Photos } from "../_components/bits";
import { ResolveCharge } from "./resolve-charge";

export const instant = false;
export const metadata = { title: "Disputes", ...NO_INDEX };

const FILTERS = {
  disputed: { label: "Disputed", statuses: ["disputed"] },
  requested: { label: "Awaiting the guest", statuses: ["requested"] },
  failed: { label: "Card failed", statuses: ["failed"] },
  open: { label: "All open", statuses: ["disputed", "requested", "failed"] },
  closed: { label: "Settled", statuses: ["paid", "declined", "cancelled"] },
} as const;
type Filter = keyof typeof FILTERS;

const STATUS: Record<TripCharge["status"], { label: string; tone: Tone }> = {
  requested: { label: "Awaiting guest", tone: "butter" },
  disputed: { label: "Disputed", tone: "peach" },
  failed: { label: "Card failed", tone: "peach" },
  paid: { label: "Paid", tone: "mint" },
  declined: { label: "Declined", tone: "board" },
  cancelled: { label: "Withdrawn", tone: "board" },
};

const KIND: Record<TripCharge["kind"], string> = {
  extra_miles: "Extra miles",
  fuel: "Fuel",
  tolls: "Tolls",
  cleaning: "Cleaning",
  smoking: "Smoking",
  late_return: "Late return",
  damage: "Damage",
  other: "Other",
};

type ChargeRow = TripCharge & {
  failure_reason?: string | null;
  trip: {
    id: string;
    starts_at: string;
    ends_at: string;
    deposit_cents: number;
    deposit_status: string;
    vehicle: { make: string; model: string; year: number } | null;
  } | null;
  guest: { full_name: string } | null;
  host: { full_name: string } | null;
};

export default async function DisputesPage({ searchParams }: PageProps<"/host/admin/disputes">) {
  await requireAdminPage("/host/admin/disputes");
  const sp = await searchParams;
  const filter: Filter = typeof sp.status === "string" && sp.status in FILTERS ? (sp.status as Filter) : "disputed";

  const admin = createAdminClient();
  const { data } = await admin
    .from("trip_charges")
    .select(
      "*, trip:trips(id, starts_at, ends_at, deposit_cents, deposit_status, vehicle:vehicles(make, model, year)), guest:profiles!guest_id(full_name), host:profiles!host_id(full_name)"
    )
    .in("status", [...FILTERS[filter].statuses])
    .order("created_at", { ascending: filter === "closed" ? false : true })
    .limit(50);
  const charges = (data ?? []) as unknown as ChargeRow[];

  const tripIds = [...new Set(charges.map((c) => c.trip_id))];
  const { data: inspectionRows } = tripIds.length
    ? await admin.from("trip_inspections").select("*").in("trip_id", tripIds).order("created_at")
    : { data: [] as TripInspection[] };
  const inspections = inspectionRows ?? [];

  const [emails, urls] = await Promise.all([
    emailsFor(charges.flatMap((c) => [c.guest_id, c.host_id])),
    signedPhotos([...charges.flatMap((c) => c.photos), ...inspections.flatMap((i) => i.photos)]),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4">
      <PageTitle title="Disputes" lead="Charges hosts sent after a trip. Look at both sides and the check-in photos, then decide." />
      <FilterLinks
        current={filter}
        options={Object.entries(FILTERS).map(([value, f]) => ({
          value,
          label: f.label,
          href: value === "disputed" ? "/host/admin/disputes" : `/host/admin/disputes?status=${value}`,
        }))}
      />

      {charges.length === 0 && <EmptyState icon={<Gavel />} title="Nothing here." body="No charges in this list right now." />}

      {charges.map((c) => {
        const status = STATUS[c.status];
        const tripInspections = inspections.filter((i) => i.trip_id === c.trip_id);
        const car = c.trip?.vehicle ? `${c.trip.vehicle.year} ${c.trip.vehicle.make} ${c.trip.vehicle.model}` : "Car";
        const guest = c.guest?.full_name ?? "Guest";
        const open = c.status === "disputed" || c.status === "requested" || c.status === "failed";
        return (
          <Tile key={c.id} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <TileTitle>
                  {KIND[c.kind]} · {formatCurrency(c.amount_cents)}
                </TileTitle>
                <Link href={`/host/admin/trips/${c.trip_id}`} className="text-[15px] font-semibold text-slate hover:text-cobalt">
                  {car}
                  {c.trip ? `, ${formatRange(c.trip.starts_at, c.trip.ends_at)}` : ""}
                </Link>
              </div>
              <Tag tone={status.tone}>{status.label}</Tag>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Fact label="Host" value={`${c.host?.full_name ?? "Host"} · ${emails[c.host_id] ?? ""}`} />
              <Fact label="Guest" value={`${guest} · ${emails[c.guest_id] ?? ""}`} />
              <Fact label="Sent" value={formatDateTime(c.created_at)} />
              <Fact
                label="Deposit"
                value={c.trip && c.trip.deposit_cents > 0 ? `${formatCurrency(c.trip.deposit_cents)}, ${c.trip.deposit_status}` : "None"}
              />
            </div>

            <div className="flex flex-col gap-1.5 rounded-[16px] bg-board px-4 py-3">
              <span className="text-[13px] font-bold text-slate">The host says</span>
              <p className="text-[15px] whitespace-pre-wrap">{c.description}</p>
            </div>
            {c.guest_note && (
              <div className="flex flex-col gap-1.5 rounded-[16px] bg-peach px-4 py-3 text-peach-ink">
                <span className="text-[13px] font-bold">The guest says</span>
                <p className="text-[15px] whitespace-pre-wrap">{c.guest_note}</p>
              </div>
            )}
            {c.failure_reason && (
              <p className="rounded-[14px] bg-error-soft px-3.5 py-3 text-[15px] font-semibold text-error">{c.failure_reason}</p>
            )}
            {c.resolution_note && (
              <div className="flex flex-col gap-1.5 rounded-[16px] bg-mint px-4 py-3 text-mint-ink">
                <span className="text-[13px] font-bold">Cascade&apos;s note</span>
                <p className="text-[15px] whitespace-pre-wrap">{c.resolution_note}</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold text-slate">Charge photos</span>
              <Photos paths={c.photos} urls={urls} />
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-[13px] font-bold text-slate">Check-in and check-out</span>
              {tripInspections.length === 0 && <p className="text-[14px] text-slate">Nobody logged an inspection on this trip.</p>}
              {tripInspections.map((i) => (
                <div key={i.id} className="flex flex-col gap-2 rounded-[16px] bg-board px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-[15px] font-bold">
                      {i.kind === "pickup" ? "Pick-up" : "Return"}, by the {i.role}
                    </span>
                    <span className="text-[13px] text-slate">{formatDateTime(i.created_at)}</span>
                  </div>
                  <p className="figures text-[14px]">
                    {i.odometer_mi != null ? `${i.odometer_mi.toLocaleString("en-US")} mi` : "No odometer"}
                    {" · "}
                    {i.fuel_pct != null ? `${i.fuel_pct}% fuel` : "No fuel reading"}
                  </p>
                  {i.notes && <p className="text-[14px] whitespace-pre-wrap">{i.notes}</p>}
                  <Photos paths={i.photos} urls={urls} />
                </div>
              ))}
            </div>

            {open && <ResolveCharge chargeId={c.id} amountCents={c.amount_cents} guest={guest} />}
          </Tile>
        );
      })}
    </div>
  );
}
