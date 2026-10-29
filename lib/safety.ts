import { daysBetween } from "@/components/host/days";
import type { VehicleInspection, VehicleMaintenance } from "@/lib/supabase/types";

/**
 * Safety & inspections: the yearly checklist, the kinds of work a host logs,
 * and the rules for when each is due. The database's listing guard
 * (vehicle_inspection_due_on) uses the same yearly rule.
 */

export type CheckResult = "pass" | "fail" | "na";

/** Checklist items, grouped the way a walk around the car goes. Ids are stored, so never rename one. */
export const CHECKLIST: readonly { group: string; items: readonly { id: string; label: string; help?: string }[] }[] = [
  {
    group: "Tires and brakes",
    items: [
      { id: "tire_tread", label: "Tire tread", help: "At least 4/32 in. on every tire, no bulges or cuts" },
      { id: "tire_pressure", label: "Tire pressure", help: "Set to the door sticker, warning light off" },
      { id: "spare", label: "Spare or inflator kit" },
      { id: "brakes", label: "Brakes", help: "No grinding, pulling or soft pedal" },
    ],
  },
  {
    group: "Lights and glass",
    items: [
      { id: "lights", label: "Headlights, brake lights and signals" },
      { id: "windshield", label: "Windshield", help: "No cracks in the driver's view" },
      { id: "wipers", label: "Wipers and washer fluid" },
      { id: "mirrors", label: "Mirrors" },
    ],
  },
  {
    group: "Under the hood",
    items: [
      { id: "warning_lights", label: "No warning lights", help: "Check engine, oil, battery, airbag" },
      { id: "oil", label: "Oil level and change date" },
      { id: "fluids", label: "Coolant and brake fluid" },
      { id: "battery", label: "Battery", help: "Starts cleanly, no corrosion" },
    ],
  },
  {
    group: "Inside",
    items: [
      { id: "seat_belts", label: "Seat belts", help: "Every belt latches and retracts" },
      { id: "horn", label: "Horn" },
      { id: "climate", label: "Heat, AC and defrost" },
      { id: "interior", label: "Clean interior, no smell" },
    ],
  },
  {
    group: "Papers",
    items: [
      { id: "registration", label: "Current registration in the car" },
      { id: "recalls", label: "No open recalls", help: "Check the VIN on nhtsa.gov/recalls" },
    ],
  },
];

export const CHECKLIST_ITEMS = CHECKLIST.flatMap((g) => g.items);
export const CHECKLIST_LABEL = new Map(CHECKLIST_ITEMS.map((i) => [i.id, i.label]));

/** Passed when nothing failed. Items left blank count as not checked, so every item needs an answer. */
export function checklistPassed(checklist: Record<string, CheckResult>): boolean {
  return CHECKLIST_ITEMS.every((i) => checklist[i.id] === "pass" || checklist[i.id] === "na");
}

export const MAINTENANCE_KINDS = {
  oil_change: "Oil change",
  tires: "Tires",
  brakes: "Brakes",
  battery: "Battery",
  fluids: "Fluids",
  wipers: "Wipers",
  alignment: "Alignment",
  recall: "Recall",
  repair: "Repair",
  cleaning: "Cleaning or detail",
  other: "Other",
} as const satisfies Record<VehicleMaintenance["kind"], string>;

/** What most hosts set as the next one, so the form can fill it in. */
export const TYPICAL_INTERVAL: Partial<Record<VehicleMaintenance["kind"], { months?: number; miles?: number }>> = {
  oil_change: { months: 6, miles: 5000 },
  tires: { miles: 40000 },
  brakes: { miles: 30000 },
  battery: { months: 48 },
  wipers: { months: 12 },
  alignment: { months: 12 },
};

/** Shown on the car page; a report against one can get a car unlisted. */
export const QUALITY_STANDARDS = [
  "No warning lights on the dashboard",
  "Tires with safe tread and the right pressure",
  "Working brakes, lights, horn, wipers and seat belts",
  "No open safety recalls",
  "A windshield clear of cracks in the driver's view",
  "Clean inside and out, with no smoke or pet smell",
  "Current registration in the car",
] as const;

/** A car's inspection is due this long after the last passing one, or after it was added. */
export const INSPECTION_EVERY_DAYS = 365;
/** Due within this many days counts as due soon. */
export const DUE_SOON_DAYS = 30;

export type DueState = "overdue" | "soon" | "ok";

/** The date key the car's next inspection is due. Matches vehicle_inspection_due_on in the database. */
export function inspectionDueOn(carCreatedOn: string, inspections: Pick<VehicleInspection, "inspected_on" | "passed">[]): string {
  const last = inspections.filter((i) => i.passed).map((i) => i.inspected_on).sort().at(-1) ?? carCreatedOn;
  // A year on, by calendar: Feb 29 lands on Feb 28, as it does in Postgres.
  const [y, m, d] = last.split("-").map(Number);
  const next = new Date(Date.UTC(y + 1, m - 1, d));
  if (next.getUTCMonth() !== m - 1) next.setUTCDate(0);
  return next.toISOString().slice(0, 10);
}

export function dueState(dueOn: string, today: string): DueState {
  const left = daysBetween(today, dueOn);
  return left < 0 ? "overdue" : left <= DUE_SOON_DAYS ? "soon" : "ok";
}

/** The rate a car has to stay above on its last rated trips. */
export const RATE_TRIPS = 10;
export const RATE_FLOOR = 0.5;

/**
 * Share of the last RATE_TRIPS ratings that gave five stars, and how many more
 * rated trips it needs before the rate counts. Ratings are newest first.
 */
export function recentRate(ratings: (number | null)[]): { rate: number | null; rated: number; needed: number } {
  const given = ratings.filter((r): r is number => typeof r === "number").slice(0, RATE_TRIPS);
  return {
    rate: given.length ? given.filter((r) => r === 5).length / given.length : null,
    rated: given.length,
    needed: Math.max(0, RATE_TRIPS - given.length),
  };
}

export interface DueWork {
  kind: VehicleMaintenance["kind"];
  label: string;
  state: DueState;
  /** "Due Dec 3" or "Due in 600 mi", whichever comes first. */
  dueOn: string | null;
  milesLeft: number | null;
}

/**
 * Work coming due: for each kind, the latest entry that set a next date or
 * mileage. Miles count from the car's last known odometer reading.
 */
export function dueWork(entries: VehicleMaintenance[], odometerMi: number | null, today: string): DueWork[] {
  const latest = new Map<string, VehicleMaintenance>();
  for (const e of [...entries].sort((a, b) => a.done_on.localeCompare(b.done_on) || a.created_at.localeCompare(b.created_at))) {
    latest.set(e.kind, e);
  }
  const out: DueWork[] = [];
  for (const e of latest.values()) {
    if (!e.next_due_on && e.next_due_mi == null) continue;
    const milesLeft = e.next_due_mi != null && odometerMi != null ? e.next_due_mi - odometerMi : null;
    const byDate = e.next_due_on ? dueState(e.next_due_on, today) : "ok";
    const byMiles: DueState = milesLeft == null ? "ok" : milesLeft < 0 ? "overdue" : milesLeft <= 500 ? "soon" : "ok";
    const rank = { overdue: 2, soon: 1, ok: 0 } as const;
    out.push({
      kind: e.kind,
      label: MAINTENANCE_KINDS[e.kind],
      state: rank[byDate] >= rank[byMiles] ? byDate : byMiles,
      dueOn: e.next_due_on,
      milesLeft,
    });
  }
  const order = { overdue: 0, soon: 1, ok: 2 } as const;
  return out.sort((a, b) => order[a.state] - order[b.state] || (a.dueOn ?? "9").localeCompare(b.dueOn ?? "9"));
}

/** A date key some months on, for the form's suggested next date. */
export function monthsAfter(dateKey: string, months: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1 + months, d));
  if (next.getUTCDate() !== d) next.setUTCDate(0);
  return next.toISOString().slice(0, 10);
}
