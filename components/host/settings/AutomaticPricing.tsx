"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import type { AutoPrice } from "@/lib/auto-pricing";
import { cn, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/host/settings/Switch";

function dollars(cents: number | null): string {
  return cents == null ? "" : String(Math.round(cents / 100));
}

function toCents(value: string): number | null {
  const n = parseFloat(value);
  return value.trim() === "" || isNaN(n) ? null : Math.round(n * 100);
}

const pctLabel = (pct: number) => `${pct > 0 ? "+" : ""}${pct}%`;

/** Automatic pricing on the host's car page: the switch, floor and ceiling, and the next two weeks it would charge. */
export function AutomaticPricing({
  vehicleId,
  on: savedOn,
  minCents: savedMin,
  maxCents: savedMax,
  defaults,
  preview,
}: {
  vehicleId: string;
  on: boolean;
  minCents: number | null;
  maxCents: number | null;
  /** The floor and ceiling used when the host leaves them empty. */
  defaults: { min: number; max: number };
  preview: { date: string; price: AutoPrice }[];
}) {
  const router = useRouter();
  const [on, setOn] = useState(savedOn);
  const [min, setMin] = useState(dollars(savedMin));
  const [max, setMax] = useState(dollars(savedMax));
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState(0);

  const dirty = on !== savedOn || toCents(min) !== savedMin || toCents(max) !== savedMax;
  const day = preview[picked];

  async function save() {
    const minCents = toCents(min);
    const maxCents = toCents(max);
    if ((minCents != null && minCents < 100) || (maxCents != null && maxCents < 100)) {
      toast.error("Prices start at $1.");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/vehicles/${vehicleId}/auto-pricing`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on, minCents, maxCents }),
    });
    setSaving(false);
    const body: { error?: string } = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.error ?? "Couldn't save that. Try again.");
      return;
    }
    toast.success(on ? "Saved. Cascade now prices this car's days." : "Saved. Automatic pricing is off.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-[24px] bg-sky p-5 text-ink">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="flex items-center gap-2 text-[20px]">
            <Sparkles className="size-5" /> Automatic pricing
          </h3>
          <p className="max-w-[60ch] text-[15px] text-sky-ink">
            Cascade sets each day&apos;s price from your daily rate: the day of the week, the season, holidays and events,
            how far ahead it is, and how busy cars nearby are. Prices update every night. A price you set on the calendar
            always wins.
          </p>
        </div>
        <Switch checked={on} onChange={setOn} label={on ? "On" : "Off"} className={on ? undefined : "bg-white"} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[140px] flex-1 flex-col gap-1">
          <span className="text-[12px] font-semibold opacity-75">Lowest price a day</span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={min}
            placeholder={dollars(defaults.min)}
            onChange={(e) => setMin(e.target.value)}
            className="rounded-[14px] bg-white px-3.5 py-3 text-base font-bold outline-none placeholder:font-medium placeholder:text-quiet focus:ring-2 focus:ring-ink"
          />
        </label>
        <label className="flex min-w-[140px] flex-1 flex-col gap-1">
          <span className="text-[12px] font-semibold opacity-75">Highest price a day</span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={max}
            placeholder={dollars(defaults.max)}
            onChange={(e) => setMax(e.target.value)}
            className="rounded-[14px] bg-white px-3.5 py-3 text-base font-bold outline-none placeholder:font-medium placeholder:text-quiet focus:ring-2 focus:ring-ink"
          />
        </label>
        <Button disabled={saving || !dirty} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      <p className="-mt-2 text-[12px] text-sky-ink">
        Left empty, prices stay between {formatPrice(defaults.min)} and {formatPrice(defaults.max)}.
      </p>

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold">{on && savedOn ? "Your next two weeks" : "What the next two weeks would cost"}</span>
        <div className="grid grid-cols-7 gap-1.5">
          {preview.map(({ date, price }, i) => {
            const d = new Date(`${date}T12:00:00Z`);
            return (
              <button
                key={date}
                type="button"
                onClick={() => setPicked(i)}
                aria-pressed={picked === i}
                className={cn(
                  "flex flex-col items-center rounded-[12px] px-1 py-2 transition-colors",
                  picked === i ? "bg-ink text-white" : "bg-white hover:bg-line"
                )}
              >
                <span className="text-[11px] font-semibold opacity-70">
                  {d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })} {d.getUTCDate()}
                </span>
                <span className="figures text-[15px] font-extrabold">{formatPrice(price.cents)}</span>
                <span className={cn("figures text-[11px] font-semibold", picked === i ? "opacity-80" : "text-slate")}>
                  {price.pct ? pctLabel(price.pct) : price.factors.length ? "Evens out" : "Base"}
                </span>
              </button>
            );
          })}
        </div>
        {day && (
          <div className="flex flex-wrap items-center gap-1.5 rounded-[14px] bg-white px-3 py-2.5 text-[13px]">
            <span className="font-bold">
              {new Date(`${day.date}T12:00:00Z`).toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })}
              :
            </span>
            {day.price.factors.length ? (
              day.price.factors.map((f) => (
                <span key={f.label} className="rounded-[8px] bg-board px-2 py-0.5 font-semibold">
                  {f.label} {pctLabel(f.pct)}
                </span>
              ))
            ) : (
              <span className="text-slate">Nothing moves this day, so it&apos;s your daily rate.</span>
            )}
            {day.price.limit && (
              <span className="rounded-[8px] bg-butter px-2 py-0.5 font-semibold">
                Held at your {day.price.limit === "floor" ? "lowest" : "highest"} price
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
