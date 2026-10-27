import { cn, pluralize } from "@/lib/utils";
import { REVIEW_CATEGORIES, averageOf, type CategoryRatings } from "./categories";

/**
 * Average guest rating per category as bars, like the reviews section of a
 * car page. Pass the guest reviews (only the category columns are read).
 * Categories nobody rated are left out, and nothing renders if none were.
 */
export function CategoryBars({ reviews, className }: { reviews: Partial<CategoryRatings>[]; className?: string }) {
  const rows = REVIEW_CATEGORIES.flatMap((c) => {
    const value = averageOf(reviews.map((r) => r[c.column]));
    return value === null ? [] : [{ key: c.key, label: c.label, value }];
  });
  if (!rows.length) return null;
  const rated = reviews.filter((r) => REVIEW_CATEGORIES.some((c) => r[c.column] != null)).length;

  return (
    <div className={cn("figures flex flex-col gap-2.5", className)}>
      {rows.map((row) => (
        <div key={row.key} className="grid grid-cols-[120px_1fr_32px] items-center gap-3 text-[15px]">
          <span className="font-semibold">{row.label}</span>
          <span className="h-2.5 overflow-hidden rounded-[5px] bg-line">
            <span className="block h-full rounded-[5px] bg-ink" style={{ width: `${(row.value / 5) * 100}%` }} />
          </span>
          <span className="text-right font-extrabold">{row.value.toFixed(1)}</span>
        </div>
      ))}
      <span className="text-[13px] text-slate">Based on {pluralize(rated, "guest rating")}</span>
    </div>
  );
}
