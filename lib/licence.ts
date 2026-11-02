/** The manual licence check. Safe to import from browser code. */
export const LICENCE_BUCKET = "guest-licences";

/** Vercel refuses a request over about 4.5 MB, and two photos go up together. */
export const UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

/** Why a host can turn a licence down. Each is shown to the guest as written. */
export const LICENCE_REJECT_REASONS = [
  "The name doesn't match your booking.",
  "The date of birth doesn't match your booking.",
  "The selfie doesn't match the licence photo.",
  "The licence photo is hard to read.",
  "The selfie doesn't show you holding your licence.",
  "The licence has expired.",
] as const;

export type LicenceReason = (typeof LICENCE_REJECT_REASONS)[number];
