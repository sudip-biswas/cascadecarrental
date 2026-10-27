import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Trip, TripCharge, Vehicle } from "@/lib/supabase/types";
import { hostEarningsCents } from "@/lib/pricing";
import { CANCEL_REASON, isAbandoned } from "@/lib/trip-status";
import { toDateKey } from "@/lib/utils";

type Client = SupabaseClient<Database>;
type Car = Pick<Vehicle, "id" | "make" | "model" | "year">;

export type EarningsTrip = Pick<
  Trip,
  | "id"
  | "vehicle_id"
  | "guest_id"
  | "status"
  | "payment_status"
  | "subtotal_cents"
  | "starts_at"
  | "ends_at"
  | "cancellation_reason"
  | "paid_out_at"
> & {
  guest: { full_name: string | null } | null;
  vehicle: Car | null;
};

export type EarningsCharge = Pick<
  TripCharge,
  "id" | "trip_id" | "kind" | "amount_cents" | "status" | "description" | "created_at" | "responded_at" | "paid_out_at"
>;

export interface EarningsData {
  trips: EarningsTrip[];
  /** Paid post-trip charges. The host keeps all of each one. */
  charges: EarningsCharge[];
  cars: Car[];
}

/** Everything the earnings and transactions pages need, straight from the database. */
export async function loadEarnings(supabase: Client, hostId: string): Promise<EarningsData> {
  const [trips, charges, cars] = await Promise.all([
    supabase
      .from("trips")
      .select(
        "id, vehicle_id, guest_id, status, payment_status, subtotal_cents, starts_at, ends_at, cancellation_reason, paid_out_at, guest:profiles!guest_id(full_name), vehicle:vehicles(id, make, model, year)"
      )
      .eq("host_id", hostId)
      .order("ends_at", { ascending: false })
      .overrideTypes<EarningsTrip[], { merge: false }>(),
    supabase
      .from("trip_charges")
      .select("id, trip_id, kind, amount_cents, status, description, created_at, responded_at, paid_out_at")
      .eq("host_id", hostId)
      .eq("status", "paid"),
    supabase.from("vehicles").select("id, make, model, year").eq("host_id", hostId).order("created_at"),
  ]);
  return {
    trips: (trips.data ?? []).filter((t) => !isAbandoned(t)),
    charges: charges.data ?? [],
    cars: cars.data ?? [],
  };
}

/**
 * Where a trip's money sits. Earned: finished and paid. Upcoming: paid, not
 * finished yet. Missed: cancelled by either side, or a request that was
 * declined or never answered. Open requests count for nothing yet.
 */
export type TripMoney = "earned" | "upcoming" | "missed" | "none";

export function tripMoney(t: Pick<Trip, "status" | "payment_status">): TripMoney {
  if (t.status === "cancelled_guest" || t.status === "cancelled_host") return "missed";
  if (t.payment_status !== "captured") return "none";
  if (t.status === "completed") return "earned";
  if (t.status === "approved" || t.status === "active") return "upcoming";
  return "none";
}

/** The host's share of a trip and Cascade's fee on it. */
export function tripSplit(t: Pick<Trip, "subtotal_cents">) {
  const earned = hostEarningsCents(t.subtotal_cents);
  return { gross: t.subtotal_cents, fee: t.subtotal_cents - earned, earned };
}

/** When a charge was paid. Older rows only have their request date. */
export const chargePaidAt = (c: EarningsCharge) => c.responded_at ?? c.created_at;

export const yearOf = (date: string | Date) => toDateKey(date).slice(0, 4);

/** The short reference shown on a trip's page. */
export const reservationNumber = (tripId: string) => tripId.slice(0, 8).toUpperCase();

export const carName = (car: Car | null) => (car ? `${car.make} ${car.model} ${car.year}` : "Car");

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface MonthTotals {
  month: string;
  trips: number;
  upcoming: number;
  reimbursements: number;
  missed: number;
}

export type Totals = Omit<MonthTotals, "month">;

export interface CarEarnings {
  car: Car;
  earnedCents: number;
  trips: number;
}

/** Years with any trip, plus this one, newest first. */
export function earningYears(data: EarningsData, now = new Date()): string[] {
  const years = new Set([yearOf(now), ...data.trips.map((t) => yearOf(t.ends_at))]);
  return [...years].sort().reverse();
}

/** A year of earnings by month, for one car or all of them. Trips count in the month they end. */
export function earningsYear(data: EarningsData, year: string, car?: string) {
  const months: MonthTotals[] = MONTHS.map((month) => ({ month, trips: 0, upcoming: 0, reimbursements: 0, missed: 0 }));
  const slot = (date: string) => months[Number(toDateKey(date).slice(5, 7)) - 1];
  const tripCar = new Map(data.trips.map((t) => [t.id, t.vehicle_id]));
  const byCar = new Map<string, { earnedCents: number; trips: number }>(
    data.cars.map((c) => [c.id, { earnedCents: 0, trips: 0 }])
  );

  for (const t of data.trips) {
    if (yearOf(t.ends_at) !== year) continue;
    const kind = tripMoney(t);
    const { earned } = tripSplit(t);
    if (kind === "earned") {
      const entry = byCar.get(t.vehicle_id);
      if (entry) {
        entry.earnedCents += earned;
        entry.trips += 1;
      }
    }
    if (car && t.vehicle_id !== car) continue;
    if (kind === "earned") slot(t.ends_at).trips += earned;
    else if (kind === "upcoming") slot(t.ends_at).upcoming += earned;
    else if (kind === "missed") slot(t.ends_at).missed += earned;
  }

  for (const c of data.charges) {
    const paidAt = chargePaidAt(c);
    if (yearOf(paidAt) !== year) continue;
    const vehicle = tripCar.get(c.trip_id);
    const entry = vehicle ? byCar.get(vehicle) : undefined;
    if (entry) entry.earnedCents += c.amount_cents;
    if (car && vehicle !== car) continue;
    slot(paidAt).reimbursements += c.amount_cents;
  }

  const totals: Totals = { trips: 0, upcoming: 0, reimbursements: 0, missed: 0 };
  for (const m of months) {
    totals.trips += m.trips;
    totals.upcoming += m.upcoming;
    totals.reimbursements += m.reimbursements;
    totals.missed += m.missed;
  }

  const ranking: CarEarnings[] = data.cars
    .map((c) => ({ car: c, ...byCar.get(c.id)! }))
    .sort((a, b) => b.earnedCents - a.earnedCents);

  return { months, totals, earned: totals.trips + totals.reimbursements, ranking };
}

/** Earned but not sent to the host's bank yet: finished trips and paid charges. */
export function owedCents(data: EarningsData): number {
  const trips = data.trips
    .filter((t) => tripMoney(t) === "earned" && !t.paid_out_at)
    .reduce((sum, t) => sum + tripSplit(t).earned, 0);
  const charges = data.charges.filter((c) => !c.paid_out_at).reduce((sum, c) => sum + c.amount_cents, 0);
  return trips + charges;
}

/**
 * When money next moves. Cascade sends a trip's share when it ends, so with a
 * bank connected anything owed goes out now, and after that it's the next
 * booked trip's return date.
 */
export function nextPayout(data: EarningsData, hasBank: boolean, now = new Date()): Date | "now" | "needs-bank" | null {
  if (owedCents(data) > 0) return hasBank ? "now" : "needs-bank";
  const next = data.trips
    .filter((t) => tripMoney(t) === "upcoming" && Date.parse(t.ends_at) > now.getTime())
    .map((t) => Date.parse(t.ends_at))
    .sort((a, b) => a - b)[0];
  return next ? new Date(next) : null;
}

export interface Transaction {
  key: string;
  kind: "trip" | "reimbursement" | "refund";
  tripId: string;
  guest: string | null;
  car: string;
  date: string;
  /** What the host gets, in cents. Zero for refunds. */
  amountCents: number;
  /** The trip's price before Cascade's fee, for trip rows. */
  grossCents: number | null;
  feeCents: number | null;
  note: string;
  paidOutAt: string | null;
}

const CHARGE_LABEL: Record<EarningsCharge["kind"], string> = {
  extra_miles: "Extra miles",
  fuel: "Fuel",
  tolls: "Tolls",
  cleaning: "Cleaning",
  smoking: "Smoking",
  late_return: "Late return",
  damage: "Damage",
  other: "Other",
};

function refundNote(t: EarningsTrip) {
  if (t.status === "cancelled_guest") return "Guest cancelled, refunded in full";
  if (t.cancellation_reason === CANCEL_REASON.refunded) return "Refunded by Cascade";
  return "You cancelled, guest refunded in full";
}

/** Money in and out for one year, newest first: finished trips, reimbursements and refunds. */
export function transactions(data: EarningsData, year: string): Transaction[] {
  const tripsById = new Map(data.trips.map((t) => [t.id, t]));
  const rows: Transaction[] = [];

  for (const t of data.trips) {
    const kind = tripMoney(t);
    const base = { tripId: t.id, guest: t.guest?.full_name ?? null, car: carName(t.vehicle), date: t.ends_at };
    if (kind === "earned" && yearOf(t.ends_at) === year) {
      const { gross, fee, earned } = tripSplit(t);
      rows.push({
        ...base,
        key: t.id,
        kind: "trip",
        amountCents: earned,
        grossCents: gross,
        feeCents: fee,
        note: "Trip earnings",
        paidOutAt: t.paid_out_at,
      });
    } else if (t.payment_status === "refunded" && yearOf(t.ends_at) === year) {
      rows.push({
        ...base,
        key: t.id,
        kind: "refund",
        amountCents: 0,
        grossCents: null,
        feeCents: null,
        note: refundNote(t),
        paidOutAt: null,
      });
    }
  }

  for (const c of data.charges) {
    const date = chargePaidAt(c);
    const trip = tripsById.get(c.trip_id);
    if (yearOf(date) !== year || !trip) continue;
    rows.push({
      key: c.id,
      kind: "reimbursement",
      tripId: c.trip_id,
      guest: trip.guest?.full_name ?? null,
      car: carName(trip.vehicle),
      date,
      amountCents: c.amount_cents,
      grossCents: null,
      feeCents: null,
      note: `Reimbursement: ${CHARGE_LABEL[c.kind].toLowerCase()}`,
      paidOutAt: c.paid_out_at,
    });
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

/** Quotes a CSV cell, and defuses values a spreadsheet would run as a formula. */
function cell(value: string | number) {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A CSV download from rows of cells. */
export function csvResponse(lines: (string | number)[][], filename: string) {
  return new Response(lines.map((l) => l.map(cell).join(",")).join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const dollars = (cents: number) => (cents / 100).toFixed(2);
