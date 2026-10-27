"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, type TooltipProps } from "recharts";
import type { MonthTotals } from "@/lib/earnings";

export type { MonthTotals };

/** Each part of a month's bar, bottom to top, with its fill. */
export const EARNING_SERIES = [
  { key: "trips", label: "Trip earnings", color: "#111111" },
  { key: "reimbursements", label: "Reimbursements", color: "#4CB782" },
  { key: "upcoming", label: "Upcoming earnings", color: "#FFD466" },
  { key: "missed", label: "Missed earnings", color: "#FF9F85" },
] as const;

const whole = (cents: number) => `$${Math.round(cents / 100).toLocaleString("en-US")}`;

/** "$8.7k" over a bar: twelve full numbers don't fit. Phones skip the labels and use the tooltip. */
const compact = (cents: unknown) => {
  const n = Number(cents) / 100;
  if (!(n > 0)) return "";
  return n >= 1000 ? `$${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : `$${Math.round(n)}`;
};

type Row = MonthTotals & { total: number };

function MonthTip({ active, payload }: TooltipProps<number, string>) {
  const row = payload?.[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  return (
    <div className="figures flex min-w-[200px] flex-col gap-1.5 rounded-[14px] bg-white p-3 text-sm shadow-md">
      <span className="font-bold">{row.month}</span>
      {EARNING_SERIES.filter((s) => row[s.key] > 0).map((s) => (
        <span key={s.key} className="flex items-center gap-2">
          <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
          <span className="flex-1 text-slate">{s.label}</span>
          <span className="font-bold">{whole(row[s.key])}</span>
        </span>
      ))}
    </div>
  );
}

/** Earnings by month, stacked: trips, reimbursements, booked trips and what was missed. */
export function EarningsChart({ data }: { data: MonthTotals[] }) {
  const rows: Row[] = data.map((m) => ({ ...m, total: m.trips + m.reimbursements + m.upcoming }));
  const summary = rows
    .filter((m) => m.total > 0 || m.missed > 0)
    .map((m) => `${m.month}: ${whole(m.trips)} earned, ${whole(m.upcoming)} upcoming, ${whole(m.missed)} missed`)
    .join("; ");
  const top = EARNING_SERIES.length - 1;

  return (
    <div role="img" aria-label={`Earnings by month. ${summary}`} className="h-[260px] w-full max-sm:[&_.recharts-label-list]:hidden">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 24, right: 0, left: 0, bottom: 0 }} barCategoryGap="22%">
          <XAxis
            dataKey="month"
            axisLine={{ stroke: "#E9EBEF", strokeWidth: 2 }}
            tickLine={false}
            tick={{ fontSize: 13, fontWeight: 600, fill: "#4A4D55" }}
            tickMargin={10}
            interval={0}
          />
          <Tooltip content={<MonthTip />} cursor={{ fill: "#F3F4F6", radius: 10 }} />
          {EARNING_SERIES.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              stackId="month"
              fill={s.color}
              radius={i === top ? [8, 8, 0, 0] : 0}
              maxBarSize={56}
              isAnimationActive={false}
            >
              {i === top && (
                <LabelList dataKey="total" position="top" formatter={compact} fontSize={13} fontWeight={700} fill="#111111" />
              )}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
