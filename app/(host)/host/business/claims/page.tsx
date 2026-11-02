import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { createClient, getUser } from "@/lib/supabase/server";
import { isOpenClaim } from "@/lib/claims";
import { settleTripStatuses } from "@/lib/trips";
import type { Trip, TripClaim } from "@/lib/supabase/types";
import { formatCurrency, formatDateTime, formatRange } from "@/lib/utils";
import { EmptyState, Fact, PageTitle, Tag, Tile } from "@/components/kit";
import { FilterLinks } from "@/app/(host)/host/admin/_components/bits";
import { CLAIM_STATUS, type ClaimCharge, claimAmount, hostNextStep } from "@/components/trip-panels/claims/status";

export const instant = false;
export const metadata = { title: "Claims" };

type ClaimRow = TripClaim & {
  trip: Pick<Trip, "id" | "status" | "starts_at" | "ends_at"> | null;
  vehicle: { make: string; model: string; year: number } | null;
  guest: { full_name: string } | null;
  charge: ClaimCharge | null;
};

export default async function ClaimsPage({ searchParams }: PageProps<"/host/business/claims">) {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login?redirectTo=/host/business/claims");

  await settleTripStatuses(user.id);
  const { view } = await searchParams;
  const closed = view === "closed";

  const { data } = await supabase
    .from("trip_claims")
    .select(
      "*, trip:trips(id, status, starts_at, ends_at), vehicle:vehicles(make, model, year), guest:profiles!guest_id(full_name), charge:trip_charges(id, status, amount_cents, created_at)"
    )
    .eq("host_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const all = (data ?? []) as unknown as ClaimRow[];
  const open = all.filter(isOpenClaim);
  const rows = closed ? all.filter((c) => !isOpenClaim(c)) : open;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <PageTitle title="Claims" lead={`${open.length} open`} />
      <FilterLinks
        current={closed ? "closed" : "open"}
        options={[
          { value: "open", label: "Open", href: "/host/business/claims" },
          { value: "closed", label: "Closed", href: "/host/business/claims?view=closed" },
        ]}
      />

      {rows.length === 0 && <EmptyState icon={<ShieldAlert />} title={closed ? "No closed claims." : "No open claims."} body="Report damage from a trip." />}

      {rows.map((c) => {
        const status = CLAIM_STATUS[c.status];
        const car = c.vehicle ? `${c.vehicle.year} ${c.vehicle.make} ${c.vehicle.model}` : "Car";
        const amount = claimAmount(c, c.charge);
        const next = c.trip ? hostNextStep(c, c.trip, c.charge) : null;
        return (
          <Link key={c.id} href={`/host/trips/${c.trip_id}#claim`} className="transition-transform active:scale-[0.995]">
            <Tile className="flex flex-col gap-3 hover:bg-white/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[17px] font-extrabold">{car}</span>
                  <Tag tone={status.tone}>{status.label}</Tag>
                  {c.reported_late && <Tag>Reported late</Tag>}
                </span>
                <span className="figures font-display text-[22px] font-extrabold">{amount != null ? formatCurrency(amount) : "No amount yet"}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Fact label="Guest" value={c.guest?.full_name ?? "Guest"} />
                <Fact label="Trip" value={c.trip ? formatRange(c.trip.starts_at, c.trip.ends_at) : "Not found"} />
                <Fact label="Next" value={next?.action ?? "Nothing to do"} />
                <Fact label={next?.deadlineLabel ?? "Deadline"} value={next?.deadline ? formatDateTime(next.deadline) : "None"} />
              </div>
            </Tile>
          </Link>
        );
      })}
    </div>
  );
}
