import { createClient } from "@/lib/supabase/server";
import { loadHistory } from "@/components/host/history";
import { toDateKey } from "@/lib/utils";

/** Quotes a CSV cell, and defuses values a spreadsheet would run as a formula. */
function cell(value: string | number) {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const params = new URL(req.url).searchParams;
  const { rows } = await loadHistory(supabase, user.id, {
    car: params.get("car") ?? undefined,
    year: params.get("year") ?? undefined,
  });

  const lines = [
    ["Guest", "Car", "Pick-up", "Return", "Status", "Earned (USD)", "Rating"],
    ...rows.map(({ trip, status, earnedCents, rating }) => [
      trip.guest?.full_name ?? "",
      trip.vehicle ? `${trip.vehicle.year} ${trip.vehicle.make} ${trip.vehicle.model}` : "",
      toDateKey(trip.starts_at),
      toDateKey(trip.ends_at),
      trip.status === "completed" ? "Completed" : status.label,
      (earnedCents / 100).toFixed(2),
      rating ?? "",
    ]),
  ];

  return new Response(lines.map((l) => l.map(cell).join(",")).join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cascade-trips-${toDateKey(new Date())}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
