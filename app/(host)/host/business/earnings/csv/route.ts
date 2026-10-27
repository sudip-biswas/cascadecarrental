import { createClient } from "@/lib/supabase/server";
import { firstName } from "@/components/host/bits";
import {
  carName,
  csvResponse,
  dollars,
  loadEarnings,
  reservationNumber,
  tripMoney,
  tripSplit,
  yearOf,
} from "@/lib/earnings";
import { toDateKey } from "@/lib/utils";

const STATUS = { earned: "Finished", upcoming: "Upcoming", missed: "Cancelled", none: "Request" } as const;

/** One row per trip in the year, with the price, Cascade's fee, what the host kept and when it was paid out. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const params = new URL(req.url).searchParams;
  const year = params.get("year") ?? yearOf(new Date());
  const car = params.get("car");
  const data = await loadEarnings(supabase, user.id);

  const reimbursed = new Map<string, number>();
  for (const c of data.charges) reimbursed.set(c.trip_id, (reimbursed.get(c.trip_id) ?? 0) + c.amount_cents);

  const trips = data.trips
    .filter((t) => yearOf(t.ends_at) === year && (!car || t.vehicle_id === car) && tripMoney(t) !== "none")
    .sort((a, b) => a.ends_at.localeCompare(b.ends_at));

  const lines: (string | number)[][] = [
    [
      "Reservation",
      "Car",
      "Pick-up",
      "Return",
      "Guest",
      "Status",
      "Trip price (USD)",
      "Cascade fee (USD)",
      "You earned (USD)",
      "Reimbursements (USD)",
      "Paid out",
    ],
    ...trips.map((t) => {
      const kind = tripMoney(t);
      const { gross, fee, earned } = tripSplit(t);
      const kept = kind === "earned";
      return [
        reservationNumber(t.id),
        carName(t.vehicle),
        toDateKey(t.starts_at),
        toDateKey(t.ends_at),
        firstName(t.guest?.full_name),
        STATUS[kind],
        dollars(gross),
        kept ? dollars(fee) : "0.00",
        kept ? dollars(earned) : "0.00",
        dollars(reimbursed.get(t.id) ?? 0),
        kept && t.paid_out_at ? toDateKey(t.paid_out_at) : "",
      ];
    }),
  ];

  return csvResponse(lines, `cascade-earnings-${year}.csv`);
}
