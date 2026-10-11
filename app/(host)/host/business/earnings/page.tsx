import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EarningsChart } from "@/components/host/EarningsChart";
import { formatCurrency } from "@/lib/utils";

export const instant = false;

export const metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get completed trips for earnings
  const { data: trips } = await supabase
    .from("trips")
    .select("total_cents, created_at, starts_at")
    .eq("host_id", user.id)
    .in("status", ["completed", "approved", "active"])
    .eq("payment_status", "captured")
    .order("starts_at", { ascending: false });

  const totalEarnings = (trips ?? []).reduce((sum, t) => sum + t.total_cents * 0.8, 0);
  const pendingEarnings = (trips ?? [])
    .filter((t) => new Date(t.starts_at) > new Date())
    .reduce((sum, t) => sum + t.total_cents * 0.8, 0);

  // Build monthly data for chart
  const monthlyMap: Record<string, number> = {};
  for (const trip of trips ?? []) {
    const month = trip.starts_at.slice(0, 7); // "2026-10"
    monthlyMap[month] = (monthlyMap[month] ?? 0) + trip.total_cents * 0.8;
  }

  const chartData = Object.entries(monthlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, earnings]) => ({
      month: new Date(month + "-01").toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      earnings: Math.round(earnings / 100),
    }));

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <h1 className="text-xl font-bold text-cascade-900">Earnings</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Total earned",
            value: formatCurrency(Math.round(totalEarnings)),
            sub: "All time (after 20% fee)",
          },
          {
            label: "Upcoming earnings",
            value: formatCurrency(Math.round(pendingEarnings)),
            sub: "From future booked trips",
          },
          {
            label: "Total trips",
            value: String(trips?.length ?? 0),
            sub: "Completed + active",
          },
        ].map(({ label, value, sub }) => (
          <div
            key={label}
            className="bg-white border border-border rounded-xl p-4 space-y-1"
          >
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-cascade-900">{value}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white border border-border rounded-xl p-6">
        <h2 className="text-sm font-semibold text-cascade-900 mb-4">
          Monthly earnings (last 12 months)
        </h2>
        {chartData.length > 0 ? (
          <EarningsChart data={chartData} />
        ) : (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            No earnings data yet. Complete your first trip to see earnings here.
          </div>
        )}
      </div>

      {/* Note about payouts */}
      <div className="bg-cascade-100 rounded-xl p-4 text-sm text-cascade-700">
        <p className="font-semibold mb-1">About payouts</p>
        <p>
          Payouts are sent 1 business day after trip completion via Stripe Connect.
          Set up your payout account in Profile settings.
        </p>
      </div>
    </div>
  );
}
