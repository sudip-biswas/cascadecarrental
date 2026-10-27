import type { Review } from "@/lib/supabase/types";
import { CATEGORY_BY_KEY, type CategoryKey } from "./categories";

export type RatingColumn = "rating_overall" | (typeof CATEGORY_BY_KEY)[CategoryKey]["column"];

export type ScoredReview = Pick<
  Review,
  | "trip_id"
  | "rating_overall"
  | "rating_cleanliness"
  | "rating_maintenance"
  | "rating_communication"
  | "rating_convenience"
  | "rating_accuracy"
  | "issue_tags"
>;

export function columnFor(key: CategoryKey | "overall"): RatingColumn {
  return key === "overall" ? "rating_overall" : CATEGORY_BY_KEY[key].column;
}

/** Reviews that gave this column 5 stars. */
export function fiveStars(reviews: ScoredReview[], column: RatingColumn): number {
  return reviews.filter((r) => r[column] === 5).length;
}

/** How often each of a category's tags was picked, most picked first, unpicked left out. */
export function tagCounts(reviews: ScoredReview[], key: CategoryKey): { id: string; label: string; count: number }[] {
  return CATEGORY_BY_KEY[key].tags
    .map((t) => ({ ...t, count: reviews.filter((r) => r.issue_tags?.includes(t.id)).length }))
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
}

/** 0.628 → "62.8%"; whole numbers drop the decimal. */
export function percent(share: number, decimals = 0): string {
  return `${(share * 100).toFixed(decimals).replace(/\.0+$/, "")}%`;
}
