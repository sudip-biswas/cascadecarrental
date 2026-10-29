import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Vehicle, VehicleInspection, VehicleMaintenance } from "@/lib/supabase/types";
import {
  CHECKLIST_LABEL,
  MAINTENANCE_KINDS,
  QUALITY_STANDARDS,
  RATE_FLOOR,
  RATE_TRIPS,
  dueState,
  dueWork,
  inspectionDueOn,
  recentRate,
  type DueState,
} from "@/lib/safety";
import { formatDate, formatDateShort, formatPrice, pluralize, toDateKey, zonedInstant } from "@/lib/utils";
import { tagCounts, percent, type ScoredReview } from "@/components/reviews/stats";
import { Tag, type Tone } from "@/components/kit";
import { InspectionForm } from "./InspectionForm";
import { DeleteMaintenance, MaintenanceForm } from "./MaintenanceForm";

/** Date keys are Seattle days; read as instants they would land a day early. */
const day = (key: string) => formatDate(zonedInstant(key));
const dayShort = (key: string) => formatDateShort(zonedInstant(key));

const DUE_TAG: Record<DueState, { tone: Tone; label: string; className?: string }> = {
  overdue: { tone: "white", label: "Overdue", className: "bg-error-soft text-error" },
  soon: { tone: "butter", label: "Due soon" },
  ok: { tone: "mint", label: "Up to date" },
};

function Requirement({ title, tag, children }: { title: string; tag: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-[22px] bg-board p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <h3 className="text-lg font-extrabold">{title}</h3>
        {tag}
      </div>
      {children}
    </div>
  );
}

function RateRequirement({
  title,
  what,
  ratings,
  reviews,
  category,
  carId,
}: {
  title: string;
  what: string;
  ratings: (number | null)[];
  reviews: ScoredReview[];
  category: "maintenance" | "cleanliness";
  carId: string;
}) {
  const { rate, needed } = recentRate(ratings);
  const tags = tagCounts(reviews, category).slice(0, 3);
  const low = rate != null && needed === 0 && rate < RATE_FLOOR;
  return (
    <Requirement
      title={title}
      tag={
        needed > 0 ? (
          <Tag tone="white">{pluralize(needed, "more rated trip")} needed</Tag>
        ) : (
          <Tag tone={low ? "white" : "mint"} className={low ? "bg-error-soft text-error" : undefined}>
            {percent(rate ?? 0)}
          </Tag>
        )
      }
    >
      <p className="text-[15px] text-slate">
        Keep five-star {what} on the last {RATE_TRIPS} rated trips above {percent(RATE_FLOOR)}.
        {rate != null && needed > 0 && ` ${percent(rate)} so far.`}
      </p>
      {tags.length > 0 && (
        <p className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Tag key={t.id} tone="white">
              {t.label} · {t.count}
            </Tag>
          ))}
        </p>
      )}
      <Link href={`/host/business/ratings?car=${carId}`} className="self-start text-sm font-bold hover:text-cobalt">
        Trip ratings
      </Link>
    </Requirement>
  );
}

/** Safety & inspections on the host's car page: what keeps it listed, the yearly checklist and the work log. */
export async function Safety({ car }: { car: Pick<Vehicle, "id" | "created_at" | "status"> }) {
  const supabase = await createClient();
  const [{ data: inspectionRows }, { data: workRows }, { data: reviewRows }, { data: readingRows }] = await Promise.all([
    supabase.from("vehicle_inspections").select("*").eq("vehicle_id", car.id).order("inspected_on", { ascending: false }),
    supabase.from("vehicle_maintenance").select("*").eq("vehicle_id", car.id).order("done_on", { ascending: false }),
    supabase
      .from("reviews")
      .select("trip_id, rating_overall, rating_cleanliness, rating_maintenance, rating_communication, rating_convenience, rating_accuracy, issue_tags")
      .eq("vehicle_id", car.id)
      .eq("kind", "guest_to_host")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("trip_inspections")
      .select("odometer_mi, created_at, trips!inner(vehicle_id)")
      .eq("trips.vehicle_id", car.id)
      .not("odometer_mi", "is", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const inspections = (inspectionRows ?? []) as VehicleInspection[];
  const work = (workRows ?? []) as VehicleMaintenance[];
  const reviews = (reviewRows ?? []) as ScoredReview[];

  // The last odometer reading from a trip, an inspection or the log, whichever is newest.
  const readings = [
    ...(readingRows ?? []).map((r) => ({ on: toDateKey(r.created_at), mi: r.odometer_mi as number })),
    ...inspections.filter((i) => i.odometer_mi != null).map((i) => ({ on: i.inspected_on, mi: i.odometer_mi as number })),
    ...work.filter((w) => w.odometer_mi != null).map((w) => ({ on: w.done_on, mi: w.odometer_mi as number })),
  ].sort((a, b) => b.on.localeCompare(a.on) || b.mi - a.mi);
  const odometer = readings[0]?.mi ?? null;

  const today = toDateKey(new Date());
  const dueOn = inspectionDueOn(toDateKey(car.created_at), inspections);
  const inspection = dueState(dueOn, today);
  const coming = dueWork(work, odometer, today);

  return (
    <section id="safety" className="flex scroll-mt-4 flex-col gap-5 rounded-[30px] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-[26px]">Safety & inspections</h2>
        <p className="text-[15px] text-slate">Meet these to keep the car listed.</p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-3">
        <RateRequirement
          title="Maintenance rate"
          what="maintenance ratings"
          ratings={reviews.map((r) => r.rating_maintenance)}
          reviews={reviews}
          category="maintenance"
          carId={car.id}
        />
        <RateRequirement
          title="Cleanliness rate"
          what="cleanliness ratings"
          ratings={reviews.map((r) => r.rating_cleanliness)}
          reviews={reviews}
          category="cleanliness"
          carId={car.id}
        />
        <Requirement
          title="Yearly inspection"
          tag={
            <Tag tone={DUE_TAG[inspection].tone} className={DUE_TAG[inspection].className}>
              {DUE_TAG[inspection].label}
            </Tag>
          }
        >
          <p className="text-[15px] text-slate">
            {inspection === "overdue"
              ? `Was due ${day(dueOn)}. ${car.status === "listed" ? "Submit one soon:" : "It"} can't be listed again until a passing one is in.`
              : `Inspect the car once a year. The next one is due ${day(dueOn)}.`}
          </p>
        </Requirement>
        <Requirement title="Quality standards" tag={null}>
          <p className="text-[15px] text-slate">A car reported for any of these can be unlisted.</p>
          <details className="text-[15px]">
            <summary className="cursor-pointer font-bold">See all standards</summary>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
              {QUALITY_STANDARDS.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </details>
        </Requirement>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[22px]">Inspections</h3>
          <InspectionForm vehicleId={car.id} lastOdometer={odometer} />
        </div>
        {inspections.length ? (
          <ul className="flex flex-col gap-2">
            {inspections.map((i) => {
              const failed = Object.entries(i.checklist)
                .filter(([, v]) => v === "fail")
                .map(([k]) => CHECKLIST_LABEL.get(k) ?? k);
              return (
                <li key={i.id} className="flex flex-col gap-1 rounded-[18px] bg-board p-3.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="figures text-base font-extrabold">{day(i.inspected_on)}</span>
                    {i.passed ? (
                      <Tag tone="mint">Passed</Tag>
                    ) : (
                      <Tag tone="white" className="bg-error-soft text-error">
                        Needs work
                      </Tag>
                    )}
                    <span className="figures text-sm text-slate">
                      {[i.odometer_mi != null && `${i.odometer_mi.toLocaleString()} mi`, i.inspector].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {failed.length > 0 && <span className="text-[15px]">Needs work: {failed.join(", ")}</span>}
                  {i.notes && <span className="text-[15px] whitespace-pre-line text-slate">{i.notes}</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-[18px] bg-board p-3.5 text-[15px] text-slate">
            No inspections yet. The checklist takes about 15 minutes: tires, brakes, lights, glass, fluids and papers.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[22px]">Maintenance</h3>
          <MaintenanceForm vehicleId={car.id} lastOdometer={odometer} />
        </div>
        {odometer != null && (
          <p className="figures text-sm text-slate">Last odometer reading: {odometer.toLocaleString()} mi</p>
        )}
        {coming.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {coming.map((c) => (
              <span
                key={c.kind}
                className={`figures rounded-[14px] px-3 py-2 text-sm font-bold ${c.state === "overdue" ? "bg-error-soft text-error" : c.state === "soon" ? "bg-butter text-butter-ink" : "bg-board"}`}
              >
                {c.label}:{" "}
                {[
                  c.milesLeft != null && c.milesLeft < 0 && `${(-c.milesLeft).toLocaleString()} mi overdue`,
                  c.dueOn && `${c.dueOn < today ? "was due" : "due"} ${dayShort(c.dueOn)}`,
                  c.milesLeft != null && c.milesLeft >= 0 && `in ${c.milesLeft.toLocaleString()} mi`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ))}
          </div>
        )}
        {work.length ? (
          <ul className="flex flex-col gap-2">
            {work.map((w) => (
              <li key={w.id} className="flex items-start gap-3 rounded-[18px] bg-board p-3.5">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-base font-extrabold">{MAINTENANCE_KINDS[w.kind]}</span>
                    <span className="figures text-sm text-slate">
                      {[
                        day(w.done_on),
                        w.odometer_mi != null && `${w.odometer_mi.toLocaleString()} mi`,
                        w.cost_cents != null && formatPrice(w.cost_cents),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {w.notes && <span className="text-[15px] whitespace-pre-line text-slate">{w.notes}</span>}
                </span>
                <DeleteMaintenance id={w.id} label={MAINTENANCE_KINDS[w.kind]} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[18px] bg-board p-3.5 text-[15px] text-slate">
            Nothing logged yet. Log oil changes, tires and repairs here, with when each is next due.
          </p>
        )}
      </div>
    </section>
  );
}
