import { createClient } from "@/lib/supabase/server";
import { csvResponse, dollars, loadEarnings, taxYear, yearOf, type TaxTotals } from "@/lib/earnings";

const figures = (t: TaxTotals) => [
  t.trips,
  dollars(t.grossCents),
  dollars(t.feeCents),
  dollars(t.chargesCents),
  dollars(t.netCents),
  dollars(t.paidOutCents),
  dollars(t.owedCents),
  t.refundedTrips,
  dollars(t.refundedCents),
];

/** The year by car with a total row, the same figures as the page. */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const param = new URL(req.url).searchParams.get("year");
  const year = param && /^\d{4}$/.test(param) ? param : yearOf(new Date());
  const { totals, cars } = taxYear(await loadEarnings(supabase, user.id), year);

  const lines: (string | number)[][] = [
    [
      "Car",
      "Trips",
      "Gross trip earnings (USD)",
      "Cascade fee (USD)",
      "Guest charges (USD)",
      "Net earned (USD)",
      "Paid out (USD)",
      "Owed (USD)",
      "Refunded trips",
      "Refunded trip price (USD)",
    ],
    ...cars.map((car) => [car.name, ...figures(car)]),
    ["Total", ...figures(totals)],
  ];

  return csvResponse(lines, `cascade-tax-summary-${year}.csv`);
}
