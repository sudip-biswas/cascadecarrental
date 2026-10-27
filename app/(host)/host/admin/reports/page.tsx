import Link from "next/link";
import { Flag } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { reasonLabel } from "@/lib/listing-reports";
import { NO_INDEX, carPath } from "@/lib/site";
import type { ListingReport } from "@/lib/supabase/types";
import { formatDateTime } from "@/lib/utils";
import { EmptyState, PageTitle, Tag, Tile } from "@/components/kit";
import { emailsFor, requireAdminPage } from "../_lib/admin";
import { FilterLinks } from "../_components/bits";
import { ReportToggle } from "./report-actions";

export const instant = false;
export const metadata = { title: "Reported listings · Admin", ...NO_INDEX };

type Row = ListingReport & {
  vehicle: { id: string; year: number; make: string; model: string; location_name: string; host_id: string; status: string } | null;
};

export default async function AdminReportsPage({ searchParams }: PageProps<"/host/admin/reports">) {
  await requireAdminPage("/host/admin/reports");
  const status = (await searchParams).status === "resolved" ? "resolved" : "open";

  const { data } = await createAdminClient()
    .from("listing_reports")
    .select("*, vehicle:vehicles(id, year, make, model, location_name, host_id, status)")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(200);
  const reports = (data ?? []) as unknown as Row[];
  const emails = await emailsFor(reports.flatMap((r) => [r.reporter_id, r.vehicle?.host_id ?? ""]).filter(Boolean));

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4">
      <PageTitle title="Reported listings" lead="Car pages guests flagged from the Report listing link. Hosts never see who reported." />
      <FilterLinks
        current={status}
        options={[
          { value: "open", label: "Open", href: "/host/admin/reports" },
          { value: "resolved", label: "Sorted", href: "/host/admin/reports?status=resolved" },
        ]}
      />

      {!reports.length ? (
        <EmptyState
          icon={<Flag />}
          title={status === "open" ? "Nothing reported." : "Nothing sorted yet."}
          body={status === "open" ? "When a guest reports a car, it lands here." : undefined}
        />
      ) : (
        <Tile className="flex flex-col gap-1 p-2 sm:p-2">
          {reports.map((r) => {
            const car = r.vehicle;
            return (
              <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] px-3.5 py-3 odd:bg-board/60">
                <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {car ? (
                      <Link href={carPath(car)} className="text-[17px] font-extrabold hover:underline">
                        {car.year} {car.make} {car.model}
                      </Link>
                    ) : (
                      <span className="text-[17px] font-extrabold">A deleted car</span>
                    )}
                    <Tag tone="peach">{reasonLabel(r.reason)}</Tag>
                    {car && car.status !== "listed" && <Tag>{car.status === "suspended" ? "Suspended" : "Unlisted"}</Tag>}
                  </div>
                  {r.details && <p className="text-[15px] whitespace-pre-line">{r.details}</p>}
                  <span className="text-[14px] text-slate">
                    {formatDateTime(r.created_at)} · from {emails[r.reporter_id] || "a guest"}
                    {car ? ` · host ${emails[car.host_id] || "unknown"}` : ""}
                    {r.resolved_at ? ` · sorted ${formatDateTime(r.resolved_at)}` : ""}
                  </span>
                </div>
                <ReportToggle reportId={r.id} open={r.status === "open"} />
              </div>
            );
          })}
        </Tile>
      )}
    </div>
  );
}
