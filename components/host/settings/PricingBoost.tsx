"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { LAST_MINUTE_HOURS } from "@/lib/pricing";
import { formatPrice, pluralize } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const RECOMMENDED = 5;
const CHOICES = [0, 5, 10, 15, 20, 25];

/** Last-minute boost: a percent added to trips that start within a day of booking. */
export function PricingBoost({
  vehicleId,
  dailyRateCents,
  boostPct,
  noticeHours,
}: {
  vehicleId: string;
  dailyRateCents: number;
  boostPct: number;
  noticeHours: number;
}) {
  const router = useRouter();
  const [pct, setPct] = useState(boostPct);
  const [saving, setSaving] = useState(false);
  const blocked = noticeHours >= LAST_MINUTE_HOURS;

  async function save() {
    setSaving(true);
    const { data, error } = await createClient()
      .from("vehicles")
      .update({ last_minute_boost_pct: pct, updated_at: new Date().toISOString() })
      .eq("id", vehicleId)
      .select("id");
    setSaving(false);
    if (error || !data?.length) {
      toast.error("Couldn't save that. Try again.");
      return;
    }
    toast.success(pct ? `Saved. Last-minute trips now cost ${pct}% more.` : "Saved. Last-minute boost is off.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-[24px] bg-lilac p-5 text-ink">
      <h3 className="text-[20px]">Last-minute boost</h3>
      <p className="text-[15px] text-lilac-ink">
        Earn more on last-minute trips. Your price goes up automatically when pick-up is within {LAST_MINUTE_HOURS} hours of
        booking.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[160px] flex-1 flex-col gap-1">
          <span className="text-[12px] font-semibold opacity-75">Price boost</span>
          <select
            value={pct}
            onChange={(e) => setPct(Number(e.target.value))}
            className="rounded-[14px] bg-white px-3.5 py-3 text-base font-bold text-ink outline-none focus:ring-2 focus:ring-ink"
          >
            {CHOICES.map((c) => (
              <option key={c} value={c}>
                {c === 0 ? "Off" : `${c}%`}
              </option>
            ))}
          </select>
          <span className="text-[12px] text-lilac-ink">Recommended: {RECOMMENDED}%</span>
        </label>
        <Button className="mb-[22px]" disabled={saving || pct === boostPct} onClick={save}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      {blocked ? (
        <p className="rounded-[14px] bg-white px-3 py-2.5 text-[15px]">
          Your notice is {pluralize(noticeHours, "hour")}, so no trip starts that soon. Lower it in{" "}
          <Link href="/host/hours" className="font-bold underline">
            hours
          </Link>{" "}
          for the boost to kick in.
        </p>
      ) : (
        <p className="flex items-start gap-2 rounded-[14px] bg-white px-3 py-2.5 text-[15px]">
          <Zap className="mt-0.5 size-4 shrink-0" />
          {pct > 0 ? (
            <span>
              A same-day trip goes from <span className="figures font-extrabold">{formatPrice(dailyRateCents)}</span> to{" "}
              <span className="figures font-extrabold">{formatPrice(Math.round(dailyRateCents * (1 + pct / 100)))}</span> a day.
            </span>
          ) : (
            <span>Off. Last-minute trips cost the same as any other.</span>
          )}
        </p>
      )}
    </div>
  );
}
