import type { Review } from "@/lib/supabase/types";

/**
 * The five things guests rate after a trip, Turo's set. When a category gets
 * fewer than 5 stars the guest can say what was wrong by picking tags. Tags
 * are stored as these ids in reviews.issue_tags, so never rename an id.
 */
export type CategoryKey = "cleanliness" | "maintenance" | "communication" | "convenience" | "accuracy";

export type ReviewCategory = {
  key: CategoryKey;
  column: "rating_cleanliness" | "rating_maintenance" | "rating_communication" | "rating_convenience" | "rating_accuracy";
  label: string;
  tags: readonly { id: string; label: string }[];
};

export const REVIEW_CATEGORIES: readonly ReviewCategory[] = [
  {
    key: "cleanliness",
    column: "rating_cleanliness",
    label: "Cleanliness",
    tags: [
      { id: "dirty_interior", label: "Dirty interior" },
      { id: "dirty_exterior", label: "Dirty exterior" },
      { id: "upholstery_stains", label: "Upholstery stains" },
      { id: "unpleasant_smell", label: "Unpleasant smell" },
      { id: "not_disinfected", label: "Not disinfected" },
      { id: "trash", label: "Trash or clutter" },
      { id: "pet_hair", label: "Pet hair" },
    ],
  },
  {
    key: "maintenance",
    column: "rating_maintenance",
    label: "Maintenance",
    tags: [
      { id: "low_tire_pressure", label: "Low tire pressure" },
      { id: "windshield", label: "Windshield" },
      { id: "check_engine_light", label: "Check engine light" },
      { id: "brakes", label: "Brakes" },
      { id: "low_tire_tread", label: "Low tire tread" },
      { id: "mirrors", label: "Mirrors" },
      { id: "low_oil_light", label: "Low oil light" },
      { id: "low_battery", label: "Low car battery" },
      { id: "seat_belts", label: "Seat belts" },
      { id: "maintenance_other", label: "Other" },
    ],
  },
  {
    key: "communication",
    column: "rating_communication",
    label: "Communication",
    tags: [
      { id: "host_responsiveness", label: "Host responsiveness" },
      { id: "host_attitude", label: "Host attitude" },
      { id: "pickup_instructions", label: "Pickup instructions" },
      { id: "punctuality", label: "Punctuality" },
    ],
  },
  {
    key: "convenience",
    column: "rating_convenience",
    label: "Convenience",
    tags: [
      { id: "car_location", label: "Car location" },
      { id: "car_pickup", label: "Car pickup" },
      { id: "car_dropoff", label: "Car dropoff" },
      { id: "parking_access", label: "Parking or access" },
    ],
  },
  {
    key: "accuracy",
    column: "rating_accuracy",
    label: "Accuracy",
    tags: [
      { id: "photos", label: "Photos" },
      { id: "listing_description", label: "Listing description" },
      { id: "listing_location", label: "Location" },
      { id: "mpg_range", label: "MPG or range" },
      { id: "seat_count", label: "Seat count" },
    ],
  },
];

export const CATEGORY_BY_KEY = Object.fromEntries(REVIEW_CATEGORIES.map((c) => [c.key, c])) as Record<
  CategoryKey,
  ReviewCategory
>;

/** Tag id to its label and category. */
export const ISSUE_TAGS: ReadonlyMap<string, { label: string; category: CategoryKey }> = new Map(
  REVIEW_CATEGORIES.flatMap((c) => c.tags.map((t) => [t.id, { label: t.label, category: c.key }] as const))
);

export type CategoryRatings = Pick<Review, ReviewCategory["column"]>;

/** Mean of the ratings given, or null when nobody rated it. */
export function averageOf(values: (number | null | undefined)[]): number | null {
  const set = values.filter((v): v is number => typeof v === "number");
  return set.length ? set.reduce((a, b) => a + b, 0) / set.length : null;
}
