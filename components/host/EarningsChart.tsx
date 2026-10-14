"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, XAxis } from "recharts";

export interface MonthEarnings {
  month: string;
  /** Finished trips, in cents. */
  earned: number;
  /** Paid trips that haven't finished yet, in cents. */
  booked: number;
}

const dollars = (cents: unknown) => {
  const n = Number(cents);
  return n > 0 ? `$${Math.round(n / 100).toLocaleString("en-US")}` : "";
};

/** Earned and booked per month, side by side. No grid: the labels carry the numbers. */
export function EarningsChart({ data }: { data: MonthEarnings[] }) {
  const summary = data
    .map((m) => `${m.month}: ${dollars(m.earned) || "$0"} earned, ${dollars(m.booked) || "$0"} booked`)
    .join("; ");

  return (
    <div role="img" aria-label={`Earnings by month. ${summary}`} className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 0, left: 0, bottom: 0 }} barGap={4} barCategoryGap="22%">
          <XAxis
            dataKey="month"
            axisLine={{ stroke: "#E9EBEF", strokeWidth: 2 }}
            tickLine={false}
            tick={{ fontSize: 13, fontWeight: 600, fill: "#4A4D55" }}
            tickMargin={10}
          />
          <Bar dataKey="earned" fill="#111111" radius={[10, 10, 4, 4]} maxBarSize={72} isAnimationActive={false}>
            <LabelList dataKey="earned" position="top" formatter={dollars} fontSize={14} fontWeight={700} fill="#111111" />
          </Bar>
          <Bar dataKey="booked" fill="#FFE7A0" radius={[10, 10, 4, 4]} maxBarSize={72} isAnimationActive={false}>
            <LabelList dataKey="booked" position="top" formatter={dollars} fontSize={14} fontWeight={700} fill="#111111" />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
