/* eslint-disable @next/next/no-img-element -- local object URLs, not optimisable */
import { ImageIcon } from "lucide-react";
import { Tag } from "@/components/kit";
import { formatPrice } from "@/lib/utils";
import { carName, type StepIndex, type WizardData } from "./data";
import { formatDays, formatNotice } from "./controls";

/** "How guests will see it": the search card, filling in as the host goes. */
export function Preview({ data, step }: { data: WizardData; step: StepIndex }) {
  const cover = data.photos[0];
  const details = [data.year, `${data.seats} seats`, data.locationName.trim()].filter(Boolean).join(" · ");
  const priced = step >= 2;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="px-1.5 text-sm font-bold text-slate">How guests will see it</div>
      <div className="flex flex-col gap-3.5 rounded-[28px] bg-white px-2.5 pt-2.5 pb-5">
        {cover ? (
          <img src={cover.url} alt="" className="aspect-[4/3] w-full rounded-[20px] object-cover" />
        ) : (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-[20px] bg-line text-[15px] font-semibold text-slate">
            <ImageIcon className="size-8 text-quiet" strokeWidth={1.5} />
            {step === 0 ? "Photos come next" : "Your cover photo goes here"}
          </div>
        )}
        <div className="flex flex-col gap-1 px-2.5">
          <span className="font-display text-[23px] font-extrabold">{carName(data)}</span>
          <span className="text-[15px] text-slate">{details}</span>
          <span className={priced ? "text-[22px] font-extrabold" : "text-[22px] font-extrabold text-[#c9ccd3]"}>
            {priced ? formatPrice(data.dailyRateCents) : "$–"}{" "}
            <span className="text-[15px] font-semibold text-slate">/day</span>
          </span>
        </div>
        {step >= 3 && (
          <div className="flex flex-wrap gap-1.5 px-2.5">
            <Tag>
              {data.minTripDays === data.maxTripDays
                ? formatDays(data.minTripDays)
                : `${data.minTripDays}–${formatDays(data.maxTripDays)}`}
            </Tag>
            <Tag>{data.instantBook ? "Instant book" : "Host approves"}</Tag>
            {data.advanceNoticeHours > 0 && <Tag>{formatNotice(data.advanceNoticeHours)} notice</Tag>}
          </div>
        )}
      </div>
    </div>
  );
}
