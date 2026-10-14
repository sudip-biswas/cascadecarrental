"use client";

import { Check, Landmark } from "lucide-react";
import { Tile, TileTitle, toneClass, type Tone } from "@/components/kit";
import { cn, formatPrice, pluralize } from "@/lib/utils";
import { formatDays, formatNotice } from "../controls";
import { FUEL_LABELS, TYPE_LABELS, type StepIndex, type WizardData } from "../data";
import { LIMITS } from "@/lib/listing-limits";

interface Props {
  data: WizardData;
  onEdit: (step: StepIndex) => void;
}

export function StepReview({ data, onEdit }: Props) {
  const discounts = [
    data.weeklyDiscountPct > 0 && `${data.weeklyDiscountPct}% off 7+ days`,
    data.monthlyDiscountPct > 0 && `${data.monthlyDiscountPct}% off 30+`,
    `${data.distanceIncludedMi} mi a day`,
  ].filter(Boolean);

  const tiles: { step: StepIndex; label: string; title: string; detail: string; tone: Tone }[] = [
    {
      step: 0,
      label: "1 Car",
      title: [data.year, data.make, data.model, data.trim].filter(Boolean).join(" "),
      detail: [data.color, TYPE_LABELS[data.vehicleType], FUEL_LABELS[data.fuelType].toLowerCase(), `${data.seats} seats`, data.transmission]
        .filter(Boolean)
        .join(" · "),
      tone: "white",
    },
    {
      step: 1,
      label: "2 Photos",
      title: pluralize(data.photos.length, "photo"),
      detail: data.photos.length ? "The first one is the cover" : "None yet",
      tone: "sky",
    },
    {
      step: 2,
      label: "3 Price",
      title: `${formatPrice(data.dailyRateCents)} a day`,
      detail: discounts.join(" · "),
      tone: "butter",
    },
    {
      step: 3,
      label: "4 Rules",
      title: data.locationName || "Pickup spot",
      detail: [
        data.minTripDays === data.maxTripDays
          ? formatDays(data.minTripDays)
          : `${data.minTripDays} to ${formatDays(data.maxTripDays)}`,
        data.advanceNoticeHours ? `${formatNotice(data.advanceNoticeHours)} notice` : "no notice needed",
        data.instantBook ? "instant book" : "you approve each request",
      ].join(" · "),
      tone: "lilac",
    },
  ];

  const hidden = data.photos.length < LIMITS.photosToList;

  return (
    <>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3">
        {tiles.map((t) => (
          <button
            key={t.step}
            type="button"
            onClick={() => onEdit(t.step)}
            className={cn(
              "flex flex-col gap-2 rounded-[24px] p-[18px] text-left text-ink transition-[filter] hover:brightness-[0.97]",
              toneClass[t.tone]
            )}
          >
            <span className="flex items-center justify-between text-sm font-bold">
              <span className="text-slate">{t.label}</span>
              Edit
            </span>
            <span className="font-display text-[24px] leading-tight font-extrabold">{t.title}</span>
            <span className="text-[15px] text-slate">{t.detail}</span>
          </button>
        ))}
      </div>

      {hidden && (
        <Tile tone="peach" className="text-[15px]">
          With {pluralize(data.photos.length, "photo")} the car is saved but hidden from guests. It needs{" "}
          {LIMITS.photosToList} to go live, so add {LIMITS.photosToList - data.photos.length} more before you publish
          if you can.
        </Tile>
      )}

      <Tile className="flex flex-col gap-2.5">
        <TileTitle className="mb-1">Before your first payout</TileTitle>
        <div className="flex items-center gap-3 rounded-2xl bg-mint px-3.5 py-3">
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-ink">
            <Check className="size-4 text-white" strokeWidth={3} />
          </span>
          <span className="text-base font-bold">Account set up</span>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-board px-3.5 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-white">
            <Landmark className="size-4" strokeWidth={2} />
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-bold">Bank account for payouts</span>
            <span className="text-sm text-slate">
              Payouts aren&apos;t set up on Cascade yet. Your earnings are tracked in Earnings until they are.
            </span>
          </span>
        </div>
      </Tile>
    </>
  );
}
