import type { ListingReport } from "@/lib/supabase/types";

/** Why a guest flags a car page, in the words the report form uses. */
export const REPORT_REASONS: { value: ListingReport["reason"]; label: string }[] = [
  { value: "inaccurate", label: "The details are wrong" },
  { value: "photos", label: "The photos don't match the car" },
  { value: "scam", label: "It looks like a scam" },
  { value: "unsafe", label: "The car seems unsafe" },
  { value: "offensive", label: "Something offensive" },
  { value: "other", label: "Something else" },
];

export const reasonLabel = (reason: ListingReport["reason"]) =>
  REPORT_REASONS.find((r) => r.value === reason)?.label ?? "Something else";
