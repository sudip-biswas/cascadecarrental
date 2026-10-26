import type { ChargeKind, TripCharge } from "@/lib/supabase/types";
import type { Tone } from "@/components/kit";

export const CHARGE_KINDS: { kind: ChargeKind; label: string; hint: string }[] = [
  { kind: "extra_miles", label: "Extra miles", hint: "Worked out from the check-in and check-out odometers." },
  { kind: "fuel", label: "Fuel", hint: "Came back with less fuel or charge than it left with." },
  { kind: "tolls", label: "Tolls", hint: "Toll or bridge charges from the trip. Add the toll statement." },
  { kind: "cleaning", label: "Cleaning", hint: "Needed more than a normal clean. Add photos." },
  { kind: "smoking", label: "Smoking", hint: "Smoke smell or ash. Add photos." },
  { kind: "late_return", label: "Late return", hint: "Came back late. Say how late." },
  { kind: "damage", label: "Damage", hint: "New damage since check-in. Add photos and a repair quote." },
  { kind: "other", label: "Other", hint: "Anything else. Say what it's for." },
];

export const kindLabel = (kind: ChargeKind) => CHARGE_KINDS.find((k) => k.kind === kind)?.label ?? "Charge";

export function chargeStatus(
  charge: Pick<TripCharge, "status" | "paid_from_deposit">,
  viewer: "guest" | "host"
): { label: string; tone: Tone } {
  switch (charge.status) {
    case "requested":
      return { label: viewer === "guest" ? "Waiting on you" : "Waiting on guest", tone: "butter" };
    case "paid":
      return { label: charge.paid_from_deposit ? "Paid from deposit" : "Paid", tone: "mint" };
    case "disputed":
      return { label: "Disputed", tone: "lilac" };
    case "declined":
      return { label: "Dropped", tone: "board" };
    case "cancelled":
      return { label: "Withdrawn", tone: "board" };
    case "failed":
      return { label: "Payment failed", tone: "peach" };
  }
}
