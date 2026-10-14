import Link from "next/link";
import { LegendItem } from "./bits";
import { addDays, dayOfMonth, occupantOn, OCCUPANT_FILL, type Occupant } from "./days";
import { cn } from "@/lib/utils";

const DAYS = 14;

/** Two weeks from today, one row per car, with trips and blocks drawn as bars. */
export function TwoWeekStrip({
  today,
  cars,
}: {
  today: string;
  cars: { id: string; name: string; occupants: Occupant[] }[];
}) {
  const keys = Array.from({ length: DAYS }, (_, i) => addDays(today, i));

  return (
    <section className="flex flex-col gap-4 rounded-[30px] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[26px] sm:text-[28px]">Next two weeks</h2>
        <div className="flex flex-wrap gap-3.5 text-sm text-slate">
          <LegendItem swatch="bg-ink" label="Booked" />
          <LegendItem swatch="bg-butter" label="Request" />
          <LegendItem swatch="bg-[#c9ccd3]" label="Blocked by you" />
        </div>
      </div>
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="figures grid min-w-[820px] grid-cols-[120px_repeat(14,minmax(44px,1fr))] gap-1">
          <span />
          {keys.map((key, i) => (
            <span
              key={key}
              className={cn("text-center text-[12px]", i === 0 ? "font-extrabold" : "font-semibold text-slate")}
            >
              {dayOfMonth(key)}
            </span>
          ))}
          {cars.map((car) => (
            <CarRow key={car.id} car={car} keys={keys} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CarRow({ car, keys }: { car: { id: string; name: string; occupants: Occupant[] }; keys: string[] }) {
  // Merge consecutive days held by the same trip or block into one bar.
  const cells: { key: string; span: number; occupant?: Occupant }[] = [];
  for (const key of keys) {
    const occupant = occupantOn(key, car.occupants);
    const last = cells.at(-1);
    if (occupant && last?.occupant?.id === occupant.id) last.span += 1;
    else cells.push({ key, span: 1, occupant });
  }

  return (
    <>
      <Link
        href={`/host/calendar?car=${car.id}`}
        className="self-center truncate pr-2 text-[15px] font-bold hover:text-cobalt"
      >
        {car.name}
      </Link>
      {cells.map(({ key, span, occupant }, i) => (
        <span
          key={key}
          style={span > 1 ? { gridColumn: `span ${span}` } : undefined}
          title={occupant?.label}
          className={cn(
            "flex h-12 items-center overflow-hidden rounded-[10px] px-2.5 text-[13px] font-bold whitespace-nowrap",
            occupant ? OCCUPANT_FILL[occupant.kind] : "bg-board",
            i === 0 && !occupant && "ring-2 ring-ink ring-inset"
          )}
        >
          {occupant && span > 1 ? occupant.label : null}
        </span>
      ))}
    </>
  );
}
