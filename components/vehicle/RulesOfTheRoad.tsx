import { CigaretteOff, Clock, Fuel, Gauge, Receipt, Sparkles, Zap, type LucideIcon } from "lucide-react";
import { CHARGE_WINDOW_DAYS } from "@/lib/charges";
import { Tile, TileTitle } from "@/components/kit";

function Rule({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-board">
        <Icon className="size-5" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
        <span className="text-base leading-snug font-bold">{title}</span>
        <span className="text-sm text-slate">{body}</span>
      </span>
    </li>
  );
}

/**
 * The house rules, each matched to a charge a host can actually send after
 * the trip (see ChargeKind). Hosts set the amounts, so none are promised here
 * except the per-mile fee, which is on the car.
 */
export function RulesOfTheRoad({
  host,
  electric,
  distanceIncludedMi,
  extraMileFeeCents,
}: {
  host: string;
  electric: boolean;
  distanceIncludedMi: number;
  extraMileFeeCents: number;
}) {
  return (
    <Tile className="flex flex-col gap-4 rounded-[24px]">
      <TileTitle>Rules of the road</TileTitle>
      <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Rule icon={CigaretteOff} title="No smoking" body={`Smoke smell or ash means ${host} can charge for the clean-up.`} />
        <Rule icon={Sparkles} title="Keep it tidy" body="No need to wash it. A car that needs more than a normal clean can be charged for." />
        <Rule
          icon={electric ? Zap : Fuel}
          title={electric ? "Recharge it" : "Refuel it"}
          body={`Bring it back with as much ${electric ? "charge" : "fuel"} as it had at pick-up, or pay for what's missing.`}
        />
        <Rule
          icon={Gauge}
          title="Mind the miles"
          body={`${distanceIncludedMi} miles a day are included. Each mile over is ${extraMileFeeCents}¢.`}
        />
        <Rule icon={Receipt} title="Tolls are on you" body="Tolls and bridge fees from your trip are passed on, with the statement." />
        <Rule icon={Clock} title="Be back on time" body="Running late? Ask for more time from your trip page. Late returns can be charged." />
      </ul>
      <p className="rounded-[16px] bg-board px-4 py-3 text-sm text-slate">
        Any charge comes within {CHARGE_WINDOW_DAYS} days of the trip, with photos or receipts. You can pay it or dispute it, and
        Cascade looks at both sides.
      </p>
    </Tile>
  );
}
