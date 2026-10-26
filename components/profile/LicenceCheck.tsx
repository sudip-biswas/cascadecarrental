"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Status = "unverified" | "pending" | "verified" | "failed";

interface Props {
  status: Status;
  error: string | null;
  /** Just back from Stripe's check page. */
  returned?: boolean;
}

const LEAD: Record<Status, string> = {
  unverified: "Snap your licence and a quick selfie. Takes about two minutes. Hosts see a checkmark, never the photo.",
  pending: "We're checking it. That usually takes a few minutes, and we'll let you know.",
  failed: "That check didn't go through.",
  verified: "Checked. Hosts see a checkmark, never the photo.",
};

/** The licence check: status, and a button that sends you to Stripe to do it. */
export function LicenceCheck({ status, error, returned = false }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Back from Stripe: ask it how it went, in case the webhook is still on its way.
  useEffect(() => {
    if (!returned) return;
    let gone = false;
    fetch("/api/identity")
      .then((res) => res.json())
      .catch(() => null)
      .then(() => {
        if (gone) return;
        router.replace("/profile", { scroll: false });
        router.refresh();
      });
    return () => {
      gone = true;
    };
  }, [returned, router]);

  async function start() {
    setBusy(true);
    setNotice(null);
    const res = await fetch("/api/identity", { method: "POST" }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { url?: string; error?: string; code?: string } | null;
    if (res?.ok && body?.url) {
      window.location.assign(body.url);
      return;
    }
    setBusy(false);
    if (body?.code === "identity_disabled") {
      setNotice("Stripe Identity has to be switched on for Cascade's Stripe account first. Bring your licence to pick-up for now.");
      return;
    }
    toast.error(body?.error ?? "We couldn't start the check. Try again.");
  }

  return (
    <span className="flex flex-col items-start gap-3">
      <span className="text-[15px] text-sky-ink">
        {LEAD[status]}
        {status === "failed" && error && <> {error}</>}
      </span>
      {notice && <span className="rounded-[14px] bg-white px-3 py-2 text-sm font-semibold text-ink">{notice}</span>}
      {status !== "verified" && (
        <Button onClick={start} disabled={busy} variant={status === "pending" ? "secondary" : "default"}>
          {busy
            ? "Opening…"
            : status === "failed"
              ? "Try again"
              : status === "pending"
                ? "Continue the check"
                : "Check my licence"}
        </Button>
      )}
    </span>
  );
}
