"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { formatPrice, pluralize } from "@/lib/utils";

type Day = { date: string; dynamicCents: number; yourCents: number };
type Month = { month: string; nightlyCents: number; nights: number };
type Insights = { days: Day[]; booked: Month[] };

const W = 280;
const H = 170;
const PAD = { top: 8, right: 8, bottom: 22, left: 36 };

const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const monthLabel = (key: string, year = false) =>
  new Date(`${key.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });

/** Turo's calendar insights: a car's dynamic price against the host's, day by day, and what booked trips paid. */
export function PriceInsights({
  cars,
  carId,
  onCarChange,
  onClose,
}: {
  cars: { id: string; name: string; year: number; plate: string }[];
  carId: string;
  onCarChange: (id: string) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<{ carId: string; insights: Insights | null } | null>(null);
  const [hover, setHover] = useState(0);
  const car = cars.find((c) => c.id === carId);

  useEffect(() => {
    let live = true;
    fetch(`/api/vehicles/${carId}/price-insights`)
      .then((r) => (r.ok ? r.json() : null))
      .then((insights: Insights | null) => live && setData({ carId, insights }))
      .catch(() => live && setData({ carId, insights: null }));
    return () => {
      live = false;
    };
  }, [carId]);

  const insights = data?.carId === carId ? data.insights : undefined;
  const days = useMemo(() => insights?.days ?? [], [insights]);
  const day = days[Math.min(hover, days.length - 1)];

  const chart = useMemo(() => {
    if (!days.length) return null;
    const all = days.flatMap((d) => [d.dynamicCents, d.yourCents]);
    const lo = Math.floor(Math.min(...all) / 500) * 500;
    const hi = Math.ceil(Math.max(...all) / 500) * 500 || lo + 500;
    const x = (i: number) => PAD.left + (i / Math.max(1, days.length - 1)) * (W - PAD.left - PAD.right);
    const y = (c: number) => PAD.top + (1 - (c - lo) / Math.max(1, hi - lo)) * (H - PAD.top - PAD.bottom);
    const path = (pick: (d: Day) => number) => days.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(pick(d)).toFixed(1)}`).join("");
    const ticks = [lo, Math.round((lo + hi) / 2 / 100) * 100, hi];
    const months = days.flatMap((d, i) => (d.date.endsWith("-01") ? [{ i, label: monthLabel(d.date) }] : []));
    return { x, y, dynamic: path((d) => d.dynamicCents), yours: path((d) => d.yourCents), ticks, months };
  }, [days]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <select
          value={carId}
          onChange={(e) => {
            setHover(0);
            onCarChange(e.target.value);
          }}
          aria-label="Car"
          className="min-w-0 flex-1 truncate rounded-[12px] bg-board px-3 py-2 text-[14px] font-bold outline-none focus:ring-2 focus:ring-ink"
        >
          {cars.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.year} · {c.plate}
            </option>
          ))}
        </select>
        <button type="button" onClick={onClose} aria-label="Close insights" className="rounded-[10px] p-2 hover:bg-board">
          <X className="size-4" />
        </button>
      </div>

      <section className="flex flex-col gap-2 rounded-[18px] border border-line p-4">
        <div>
          <h3 className="text-[18px] font-extrabold leading-tight">Future prices</h3>
          <p className="text-[12px] text-slate">Prices shown don&apos;t include any discounts.</p>
        </div>

        {insights === undefined && <p className="py-10 text-center text-[13px] text-slate">Loading prices…</p>}
        {insights === null && <p className="py-10 text-center text-[13px] text-slate">Couldn&apos;t load prices for {car?.name ?? "this car"}.</p>}

        {day && chart && (
          <>
            <p className="text-[14px] font-extrabold">{dayLabel(day.date)}</p>
            <div className="flex gap-4">
              <span className="flex flex-col">
                <span className="text-[12px] text-slate">Dynamic pricing</span>
                <span className="flex items-center gap-1.5 text-[16px] font-extrabold">
                  <span className="size-2 rounded-full bg-cobalt" aria-hidden />
                  {formatPrice(day.dynamicCents)}
                </span>
              </span>
              <span className="w-px bg-line" aria-hidden />
              <span className="flex flex-col">
                <span className="text-[12px] text-slate">Your price</span>
                <span className="flex items-center gap-1.5 text-[16px] font-extrabold">
                  <span className="h-0 w-3 border-t-2 border-dashed border-quiet" aria-hidden />
                  {formatPrice(day.yourCents)}
                </span>
              </span>
            </div>

            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full touch-none select-none"
              role="img"
              aria-label={`Dynamic and your prices for the next ${days.length} days`}
              onPointerMove={(e) => {
                const box = e.currentTarget.getBoundingClientRect();
                const px = ((e.clientX - box.left) / box.width) * W;
                const i = Math.round(((px - PAD.left) / (W - PAD.left - PAD.right)) * (days.length - 1));
                setHover(Math.max(0, Math.min(days.length - 1, i)));
              }}
            >
              {chart.ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={W - PAD.right} y1={chart.y(t)} y2={chart.y(t)} className="stroke-line" strokeWidth={1} />
                  <text x={PAD.left - 6} y={chart.y(t) + 4} textAnchor="end" className="fill-quiet text-[10px]">
                    {formatPrice(t)}
                  </text>
                </g>
              ))}
              {chart.months.map((m) => (
                <text key={m.i} x={chart.x(m.i)} y={H - 6} textAnchor="middle" className="fill-quiet text-[10px]">
                  {m.label}
                </text>
              ))}
              <path d={chart.yours} fill="none" className="stroke-quiet" strokeWidth={2} strokeDasharray="4 3" strokeLinejoin="round" />
              <path d={chart.dynamic} fill="none" className="stroke-cobalt" strokeWidth={2} strokeLinejoin="round" />
              <line
                x1={chart.x(hover)}
                x2={chart.x(hover)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                className="stroke-ink"
                strokeWidth={1}
              />
              <circle cx={chart.x(hover)} cy={chart.y(day.yourCents)} r={4} className="fill-quiet stroke-white" strokeWidth={2} />
              <circle cx={chart.x(hover)} cy={chart.y(day.dynamicCents)} r={4} className="fill-cobalt stroke-white" strokeWidth={2} />
            </svg>

            <details className="text-[12px]">
              <summary className="cursor-pointer font-bold text-slate">See the numbers</summary>
              <div className="mt-2 max-h-48 overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="text-slate">
                    <tr>
                      <th className="font-semibold">Day</th>
                      <th className="text-right font-semibold">Dynamic</th>
                      <th className="text-right font-semibold">Yours</th>
                    </tr>
                  </thead>
                  <tbody className="figures">
                    {days.map((d) => (
                      <tr key={d.date}>
                        <td>{dayLabel(d.date)}</td>
                        <td className="text-right">{formatPrice(d.dynamicCents)}</td>
                        <td className="text-right">{formatPrice(d.yourCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-[18px] border border-line p-4">
        <h3 className="text-[18px] font-extrabold leading-tight">Booked price trends</h3>
        <p className="text-[12px] text-slate">What booked trips paid a night, before discounts, by the month they started.</p>
        {insights && insights.booked.length === 0 && (
          <p className="rounded-[12px] bg-board p-3 text-[13px] text-slate">No booked trips on this car in the last year yet.</p>
        )}
        {insights && insights.booked.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {insights.booked.map((m) => {
              const top = Math.max(...insights.booked.map((b) => b.nightlyCents));
              return (
                <li key={m.month} className="flex items-center gap-2 text-[13px]" title={pluralize(m.nights, "night")}>
                  <span className="w-16 shrink-0 text-slate">{monthLabel(m.month, true)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block h-2.5 rounded-r-[4px] bg-cobalt" style={{ width: `${Math.max(4, (m.nightlyCents / top) * 100)}%` }} />
                  </span>
                  <span className="figures shrink-0 font-bold">{formatPrice(m.nightlyCents)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
