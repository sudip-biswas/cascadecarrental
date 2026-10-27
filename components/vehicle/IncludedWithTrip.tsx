import type { ReactNode } from "react";
import {
  CalendarSync,
  Camera,
  Gauge,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Truck,
  UserPlus,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { PROTECTION_DAILY_CENTS } from "@/lib/pricing";
import { formatCurrency, pluralize } from "@/lib/utils";
import { Tile, TileTitle } from "@/components/kit";

function Item({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: ReactNode;
  body?: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-white">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
        <span className="text-base leading-snug font-bold">{title}</span>
        {body && <span className="text-sm text-mint-ink">{body}</span>}
      </span>
    </li>
  );
}

/**
 * What every Cascade trip comes with. Only things the app really does: no
 * roadside or round-the-clock support, because Cascade doesn't offer them.
 */
export function IncludedWithTrip({
  host,
  days,
  distanceIncludedMi,
  extraMileFeeCents,
  instantBook,
  delivery,
}: {
  host: string;
  days: number | null;
  distanceIncludedMi: number;
  extraMileFeeCents: number;
  instantBook: boolean;
  delivery: boolean;
}) {
  const miles = days
    ? `${(distanceIncludedMi * days).toLocaleString("en-US")} miles for your ${pluralize(days, "day")}`
    : `${distanceIncludedMi} miles a day`;

  return (
    <Tile tone="mint" className="flex flex-col gap-4 rounded-[26px] sm:p-6">
      <TileTitle className="tracking-[-0.02em] text-ink">
        Included with your trip
      </TileTitle>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-extrabold tracking-wide text-mint-ink uppercase">
            Convenience
          </h3>
          <ul className="flex flex-col gap-3.5 text-ink">
            {instantBook ? (
              <Item
                icon={Zap}
                title="Instant book"
                body="It's yours as soon as you pay. No waiting on the host."
              />
            ) : (
              <Item
                icon={MessageSquare}
                title={`${host} confirms each request`}
                body="Your card is only held until then."
              />
            )}
            <Item
              icon={Gauge}
              title={miles}
              body={`Then ${extraMileFeeCents}¢ a mile`}
            />
            <Item
              icon={UserPlus}
              title="Add drivers after booking"
              body={`${host} approves each one. No extra charge.`}
            />
            <Item
              icon={CalendarSync}
              title="Change your dates"
              body="Ask for new dates from your trip page, even mid-trip."
            />
            {delivery && (
              <Item
                icon={Truck}
                title="Delivery available"
                body="Have the car brought to you. Pick it at checkout."
              />
            )}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-extrabold tracking-wide text-mint-ink uppercase">
            Peace of mind
          </h3>
          <ul className="flex flex-col gap-3.5 text-ink">
            <Item
              icon={RotateCcw}
              title="Free cancellation"
              body="Until pick-up on the flexible rate, or for 24 hours after booking if you pay now."
            />
            <Item
              icon={ShieldCheck}
              title="Protection plans"
              body={`From ${formatCurrency(PROTECTION_DAILY_CENTS.basic)} a day, picked at checkout.`}
            />
            <Item
              icon={Camera}
              title="Photos at pick-up and return"
              body="You both log the miles, fuel and any marks, so nobody argues later."
            />
          </ul>
        </div>
      </div>
    </Tile>
  );
}
