import { createClient } from "@/lib/supabase/server";
import { firstName } from "@/components/host/bits";
import { csvResponse, dollars, loadEarnings, reservationNumber, transactions, yearOf } from "@/lib/earnings";
import { toDateKey } from "@/lib/utils";

const TYPE = { trip: "Trip", reimbursement: "Reimbursement", refund: "Refund" } as const;

/** The year's transactions, the same rows as the page. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const year = new URL(req.url).searchParams.get("year") ?? yearOf(new Date());
  const rows = transactions(await loadEarnings(supabase, user.id), year);

  const lines: (string | number)[][] = [
    ["Date", "Type", "Reservation", "Guest", "Car", "Details", "Trip price (USD)", "Cascade fee (USD)", "Earnings (USD)", "Paid out"],
    ...rows.map((r) => [
      toDateKey(r.date),
      TYPE[r.kind],
      reservationNumber(r.tripId),
      firstName(r.guest),
      r.car,
      r.note,
      r.grossCents === null ? "" : dollars(r.grossCents),
      r.feeCents === null ? "" : dollars(r.feeCents),
      dollars(r.amountCents),
      r.paidOutAt ? toDateKey(r.paidOutAt) : r.kind === "refund" ? "" : "Owed",
    ]),
  ];

  return csvResponse(lines, `cascade-transactions-${year}.csv`);
}
