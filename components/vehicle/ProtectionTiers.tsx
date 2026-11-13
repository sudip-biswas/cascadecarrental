import { ShieldCheck } from "lucide-react";
import { PROTECTION_DAILY_CENTS, PROTECTION_PLAN_NAMES, PROTECTION_OUT_OF_POCKET, type ProtectionPlan } from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";
import { Tile, TileTitle } from "@/components/kit";

const PLANS: ProtectionPlan[] = ["basic", "standard", "premium"];

const PLAN_BULLETS: Record<ProtectionPlan, string> = {
  basic: "Covers damage above $3,000 out-of-pocket",
  standard: "Covers damage above $500 out-of-pocket",
  premium: "Covers all damage — $0 out-of-pocket",
};

function Tier({ plan, highlight }: { plan: ProtectionPlan; highlight?: boolean }) {
  const outOfPocket = PROTECTION_OUT_OF_POCKET[plan];
  return (
    <div
      className={`flex flex-col gap-2 rounded-[20px] p-4 ${
        highlight ? "bg-sky text-sky-ink ring-2 ring-sky-ink/20" : "bg-board"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[15px] font-extrabold">{PROTECTION_PLAN_NAMES[plan]}</span>
        {highlight && (
          <span className="rounded-[8px] bg-sky-ink/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
            Popular
          </span>
        )}
      </div>
      <span className="figures text-[22px] font-extrabold leading-none">
        {formatCurrency(PROTECTION_DAILY_CENTS[plan])}
        <span className="font-sans text-sm font-medium text-slate"> /day</span>
      </span>
      <span className="text-[13px] leading-snug text-slate">{PLAN_BULLETS[plan]}</span>
      <span className="text-[13px] font-semibold">
        Max out-of-pocket:{" "}
        {outOfPocket === null ? "$0" : `$${outOfPocket.toLocaleString("en-US")}`}
      </span>
    </div>
  );
}

/**
 * Protection plan comparison on the listing page — before the guest reaches checkout.
 * Shows tier names, $/day, and max out-of-pocket so the cost is visible upfront.
 */
export function ProtectionTiers() {
  return (
    <Tile className="flex flex-col gap-4 rounded-[26px] sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-board">
          <ShieldCheck className="size-5" strokeWidth={1.75} />
        </span>
        <TileTitle className="tracking-[-0.02em]">Protection plans</TileTitle>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <Tier key={plan} plan={plan} highlight={plan === "standard"} />
        ))}
      </div>

      <div className="flex flex-col gap-1.5 rounded-[16px] bg-board px-4 py-3 text-[13px] text-slate">
        <p>
          Damage waiver from Cascade Fleet LLC — not a third-party insurance policy.
          Selected at checkout; Standard is pre-selected.
        </p>
        <p>
          A <strong className="text-ink">$250 refundable hold</strong> is placed on your card at
          pick-up — <strong className="text-ink">waived with Complete</strong>.
          Roadside assistance available at $2.99/day, added at checkout.
        </p>
      </div>
    </Tile>
  );
}
