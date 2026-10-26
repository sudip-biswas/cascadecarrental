import Link from "next/link";
import { Route } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { NO_INDEX } from "@/lib/site";
import { tripStatus } from "@/lib/trip-status";
import { formatCurrency, formatRange } from "@/lib/utils";
import type { Trip } from "@/lib/supabase/types";
import { EmptyState, PageTitle, Tag, Tile } from "@/components/kit";
import { UUID, emailsFor, requireAdminPage, todayBounds, usersByEmail } from "../_lib/admin";
import { SearchBox } from "../_components/bits";

export const instant = false;
export const metadata = { title: "Trips · Admin", ...NO_INDEX };

const FIELDS =
  "id, status, payment_status, starts_at, ends_at, total_cents, guest_id, host_id, guest:profiles!guest_id(full_name), host:profiles!host_id(full_name), vehicle:vehicles(make, model, year)";

type Row = Pick<Trip, "id" | "status" | "payment_status" | "starts_at" | "ends_at" | "total_cents" | "guest_id" | "host_id"> & {
  guest: { full_name: string } | null;
  host: { full_name: string } | null;
  vehicle: { make: string; model: string; year: number } | null;
};

/** Trip id, "today", an email (or part of one), or a name. Empty shows the latest. */
async function findTrips(q: string): Promise<Row[]> {
  const admin = createAdminClient();
  const base = () => admin.from("trips").select(FIELDS).order("starts_at", { ascending: false }).limit(50);

  if (!q) {
    const { data } = await admin.from("trips").select(FIELDS).order("created_at", { ascending: false }).limit(30);
    return (data ?? []) as unknown as Row[];
  }
  if (UUID.test(q)) {
    const { data } = await base().eq("id", q);
    return (data ?? []) as unknown as Row[];
  }
  if (q.toLowerCase() === "today") {
    const { start, end } = todayBounds();
    const { data } = await base()
      .not("status", "in", '("cancelled_guest","cancelled_host")')
      .or(`and(starts_at.gte.${start},starts_at.lt.${end}),and(ends_at.gte.${start},ends_at.lt.${end})`);
    return (data ?? []) as unknown as Row[];
  }

  let ids: string[];
  if (q.includes("@")) {
    ids = (await usersByEmail(q)).map((u) => u.id);
  } else {
    // Names: strip what PostgREST treats as syntax so a stray comma can't break the filter.
    const name = q.replace(/[%,()*]/g, " ").trim();
    const { data } = await admin.from("profiles").select("id").ilike("full_name", `%${name}%`).limit(50);
    ids = (data ?? []).map((p) => p.id);
  }
  if (!ids.length) return [];
  const list = ids.join(",");
  const { data } = await base().or(`guest_id.in.(${list}),host_id.in.(${list})`);
  return (data ?? []) as unknown as Row[];
}

export default async function AdminTripsPage({ searchParams }: PageProps<"/host/admin/trips">) {
  await requireAdminPage("/host/admin/trips");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const trips = await findTrips(q);
  const emails = await emailsFor(trips.flatMap((t) => [t.guest_id, t.host_id]));

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4">
      <PageTitle title="Trips" lead="Find a trip by guest or host email, name or trip id. Type today for today's pick-ups and returns." />
      <SearchBox action="/host/admin/trips" q={q} placeholder="riley@example.com, trip id, or today" />

      {trips.length === 0 ? (
        <EmptyState icon={<Route />} title="No trips found." body={q ? "Try part of the email, or the full trip id." : "Nobody has booked yet."} />
      ) : (
        <Tile className="flex flex-col gap-1 p-2 sm:p-2">
          {trips.map((t) => {
            const status = tripStatus(t, "admin");
            const car = t.vehicle ? `${t.vehicle.year} ${t.vehicle.make} ${t.vehicle.model}` : "Car";
            return (
              <Link
                key={t.id}
                href={`/host/admin/trips/${t.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] px-3.5 py-3 hover:bg-board"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[16px] font-bold">
                    {car} · {formatRange(t.starts_at, t.ends_at)}
                  </span>
                  <span className="truncate text-[14px] text-slate">
                    {t.guest?.full_name} ({emails[t.guest_id]}) with {t.host?.full_name} ({emails[t.host_id]})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="figures text-[15px] font-bold">{formatCurrency(t.total_cents)}</span>
                  <Tag tone={status.tone}>{status.label}</Tag>
                </div>
              </Link>
            );
          })}
        </Tile>
      )}
    </div>
  );
}
