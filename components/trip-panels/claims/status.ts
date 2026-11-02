import type { Tone } from "@/components/kit";
import { AUTO_CHARGE_DAYS, claimClosesAt } from "@/lib/charge-windows";
import type { ClaimStatus, Trip, TripCharge, TripClaim } from "@/lib/supabase/types";

const DAY_MS = 86_400_000;

export const CLAIM_STATUS: Record<ClaimStatus, { label: string; tone: Tone }> = {
  reported: { label: "Reported", tone: "butter" },
  with_guest: { label: "With guest", tone: "sky" },
  disputed: { label: "Disputed", tone: "lilac" },
  escalated: { label: "With Cascade", tone: "peach" },
  resolved: { label: "Resolved", tone: "mint" },
  closed: { label: "Closed", tone: "board" },
};

export type ClaimCharge = Pick<TripCharge, "id" | "status" | "amount_cents" | "created_at">;

/** The live charge's amount, or the host's estimate. A withdrawn or declined charge doesn't count. */
export function claimAmount(claim: Pick<TripClaim, "estimate_cents">, charge: ClaimCharge | null) {
  return charge && charge.status !== "cancelled" && charge.status !== "declined" ? charge.amount_cents : claim.estimate_cents;
}

/** What the host does next on a claim, and by when. */
export function hostNextStep(
  claim: Pick<TripClaim, "status" | "documents_due_at">,
  trip: Pick<Trip, "status" | "ends_at">,
  charge: ClaimCharge | null,
  now = new Date()
): { action: string; deadlineLabel?: string; deadline?: Date } {
  const closes = claimClosesAt(trip);
  const inWindow = now < closes;
  switch (claim.status) {
    case "reported":
      if (!inWindow) return { action: "Close the claim" };
      return {
        action: trip.status === "active" ? "Escalate, or ask the guest to pay after the trip" : "Ask the guest to pay or escalate",
        deadlineLabel: "Act by",
        deadline: closes,
      };
    case "with_guest":
      if (charge?.status === "failed") return { action: "Their card failed. Withdraw the charge or escalate" };
      return {
        action: "Waiting on the guest",
        deadlineLabel: "Collected on",
        deadline: charge ? new Date(new Date(charge.created_at).getTime() + AUTO_CHARGE_DAYS * DAY_MS) : undefined,
      };
    case "disputed":
      return inWindow
        ? { action: "Cascade is looking at the charge. You can escalate", deadlineLabel: "Escalate by", deadline: closes }
        : { action: "Cascade is looking at the charge" };
    case "escalated":
      return {
        action: "Send your documents",
        deadlineLabel: "Documents due",
        deadline: claim.documents_due_at ? new Date(claim.documents_due_at) : undefined,
      };
    default:
      return { action: "Nothing to do" };
  }
}
