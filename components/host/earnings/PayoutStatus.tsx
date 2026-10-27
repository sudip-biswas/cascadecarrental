import { CheckCircle2, Landmark } from "lucide-react";
import { Tag, Tile } from "@/components/kit";
import { ConnectPayoutsButton, ManagePayoutsButton } from "@/components/host/ConnectPayoutsButton";
import { HOST_SHARE } from "@/lib/pricing";
import { stripe } from "@/lib/stripe/server";

export type ConnectStatus = "none" | "pending" | "active";

/** Check if a Connect Express account has completed onboarding. */
export async function connectStatus(accountId: string | null): Promise<ConnectStatus> {
  if (!accountId) return "none";
  try {
    const acct = await stripe.accounts.retrieve(accountId);
    if (acct.charges_enabled && acct.payouts_enabled) return "active";
    return "pending"; // account exists but onboarding not yet complete
  } catch {
    return "none";
  }
}

const SHARE = Math.round(HOST_SHARE * 100);

/** The big payout banner on the earnings page. Waits on Stripe, so render it inside Suspense. */
export async function PayoutBanner({
  accountId,
  setup,
}: {
  accountId: string | null;
  /** Where Stripe onboarding sent the host back from, if it did. */
  setup?: "done" | "refresh";
}) {
  const status = await connectStatus(accountId);

  if (status === "active") {
    return (
      <Tile tone="mint" className="flex flex-wrap items-center gap-[18px]">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[17px] bg-white/40 text-ink">
          <CheckCircle2 className="size-[26px]" strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
          <span className="font-display text-[22px] leading-tight font-extrabold sm:text-[26px]">
            {setup === "done" ? "Bank account connected!" : "Payouts active"}
          </span>
          <span className="text-[15px]">
            You keep {SHARE}% of each trip&apos;s price (excluding tax and protection). Your share is sent when each
            trip ends.
          </span>
        </span>
        <ManagePayoutsButton />
      </Tile>
    );
  }

  if (status === "pending") {
    return (
      <Tile tone="butter" className="flex flex-wrap items-center gap-[18px]">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[17px] bg-white/40 text-ink">
          <Landmark className="size-[26px]" strokeWidth={1.75} />
        </span>
        <span className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
          <span className="font-display text-[22px] leading-tight font-extrabold sm:text-[26px]">
            {setup === "refresh" ? "Link expired — continue setup" : "Finish connecting your bank"}
          </span>
          <span className="text-[15px]">
            Your Stripe account was created but onboarding isn&apos;t complete yet. Click below to continue.
          </span>
        </span>
        <ConnectPayoutsButton />
      </Tile>
    );
  }

  return (
    <Tile tone="ink" className="flex flex-wrap items-center gap-[18px]">
      <span className="flex size-14 shrink-0 items-center justify-center rounded-[17px] bg-butter text-ink">
        <Landmark className="size-[26px]" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
        <span className="font-display text-[22px] leading-tight font-extrabold sm:text-[26px]">
          Connect your bank to get paid
        </span>
        <span className="text-[15px] text-[#c9ccd3]">
          You keep {SHARE}% of each trip&apos;s price. Connect a bank account through Stripe and earnings are
          transferred automatically when each trip ends.
        </span>
      </span>
      {/* The default ink button would vanish on the ink tile. */}
      <ConnectPayoutsButton className="bg-butter text-ink hover:bg-[#ffdf80]" />
    </Tile>
  );
}

const STATUS_TAG: Record<ConnectStatus, { label: string; tone: "mint" | "butter" | "peach"; body: string }> = {
  active: {
    label: "Active",
    tone: "mint",
    body: "Your bank is connected. Each trip's earnings are sent when the trip ends.",
  },
  pending: {
    label: "Finish setup",
    tone: "butter",
    body: "Your Stripe account was created but isn't finished yet, so we're holding your earnings.",
  },
  none: {
    label: "Needs setup",
    tone: "peach",
    body: "Connect a bank account through Stripe and we'll send everything we owe you.",
  },
};

/** One-line payout status for the transactions page. Waits on Stripe, so render it inside Suspense. */
export async function PayoutStatusRow({ accountId }: { accountId: string | null }) {
  const status = await connectStatus(accountId);
  const tag = STATUS_TAG[status];
  return (
    <Tile className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <span className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
        <span className="flex items-center gap-2.5">
          <span className="font-display text-[22px] leading-tight font-extrabold">Payout status</span>
          <Tag tone={tag.tone}>{tag.label}</Tag>
        </span>
        <span className="text-[15px] text-slate">{tag.body}</span>
      </span>
      {status === "active" ? <ManagePayoutsButton /> : <ConnectPayoutsButton />}
    </Tile>
  );
}

/** Holds the space while Stripe answers. */
export function PayoutStatusFallback({ tall }: { tall?: boolean }) {
  return <div aria-hidden className={`animate-pulse rounded-[28px] bg-white/60 ${tall ? "h-[100px]" : "h-[88px]"}`} />;
}
