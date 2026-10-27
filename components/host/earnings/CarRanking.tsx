import Link from "next/link";
import { cn, formatPrice, pluralize } from "@/lib/utils";
import { carName, type CarEarnings } from "@/lib/earnings";

/** Every car, best earner first, with a bar for its share of the top car. Each row filters the page to that car. */
export function CarRanking({
  ranking,
  year,
  selected,
}: {
  ranking: CarEarnings[];
  year: string;
  selected?: string;
}) {
  const best = Math.max(1, ...ranking.map((r) => r.earnedCents));
  return (
    <section className="rounded-[28px] bg-white p-2.5">
      <div className="flex justify-between gap-3 px-3.5 py-3 text-[13px] font-bold text-slate">
        <span>All cars</span>
        <span>{year} earnings</span>
      </div>
      <ol className="figures flex flex-col">
        {ranking.map(({ car, earnedCents, trips }, i) => {
          const on = car.id === selected;
          return (
            <li key={car.id}>
              <Link
                href={on ? `?year=${year}` : `?car=${car.id}&year=${year}`}
                scroll={false}
                aria-current={on ? "true" : undefined}
                className={cn(
                  "grid grid-cols-[28px_1fr_auto] items-center gap-x-3 gap-y-2 rounded-[16px] p-3.5 text-[15px] transition-colors hover:bg-line",
                  i % 2 === 0 && "bg-board",
                  on && "bg-butter hover:bg-butter"
                )}
              >
                <span className="font-display text-[17px] font-extrabold text-slate">{i + 1}</span>
                <span className="flex min-w-0 flex-col gap-1.5">
                  <span className="truncate font-bold">{carName(car)}</span>
                  <span className="flex items-center gap-2.5">
                    <span className="h-1.5 max-w-[320px] flex-1 overflow-hidden rounded-full bg-ink/10">
                      <span
                        className="block h-full rounded-full bg-ink"
                        style={{ width: `${(earnedCents / best) * 100}%` }}
                      />
                    </span>
                    <span className="shrink-0 text-[13px] text-slate">{pluralize(trips, "trip")}</span>
                  </span>
                </span>
                <span className="text-right text-[17px] font-extrabold">{formatPrice(Math.round(earnedCents / 100) * 100)}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
