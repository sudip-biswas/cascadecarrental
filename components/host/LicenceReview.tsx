"use client";
/* eslint-disable @next/next/no-img-element -- short-lived signed links, not optimisable */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LICENCE_REJECT_REASONS, type LicenceReason } from "@/lib/licence";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const CONFIRM = [
  { id: "name", label: "The name on the licence matches the booking" },
  { id: "birthday", label: "The date of birth matches the booking" },
  { id: "selfie", label: "The person in the selfie is the person on the licence" },
  { id: "expiry", label: "The licence hasn't expired" },
] as const;

function Photo({ url, label }: { url: string; label: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex flex-col gap-1.5 text-sm font-bold">
      <img src={url} alt={label} className="aspect-[4/3] w-full rounded-[16px] bg-board object-contain" />
      {label}
    </a>
  );
}

/** The guest's two photos beside the booking, for the host to approve or reject. */
export function LicenceReview({
  tripId,
  name,
  birthday,
  licenceUrl,
  selfieUrl,
  waiting,
}: {
  tripId: string;
  name: string;
  /** Formatted date of birth on the booking. */
  birthday: string | null;
  licenceUrl: string | null;
  selfieUrl: string | null;
  /** False once it's approved: the photos stay visible for handover. */
  waiting: boolean;
}) {
  const router = useRouter();
  const [ticked, setTicked] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<LicenceReason>(LICENCE_REJECT_REASONS[0]);
  const [busy, setBusy] = useState(false);

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    const res = await fetch("/api/licence/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, decision, ...(decision === "reject" ? { reason } : {}) }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return toast.error(data?.error ?? "Couldn't save that. Try again.");
    toast.success(decision === "approve" ? "Licence approved." : "We've asked for new photos.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        {licenceUrl && <Photo url={licenceUrl} label="Licence" />}
        {selfieUrl && <Photo url={selfieUrl} label="Selfie" />}
      </div>
      <dl className="grid gap-1 rounded-[16px] bg-board p-3 text-[15px]">
        <div className="flex justify-between gap-3">
          <dt className="text-slate">Name on booking</dt>
          <dd className="text-right font-bold">{name}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-slate">Date of birth</dt>
          <dd className="text-right font-bold">{birthday ?? "Not given"}</dd>
        </div>
      </dl>

      {waiting && !rejecting && (
        <>
          <div className="flex flex-col gap-2">
            {CONFIRM.map((c) => (
              <label key={c.id} htmlFor={`licence-${c.id}`} className="flex items-start gap-2.5 text-[15px] font-semibold">
                <Checkbox
                  id={`licence-${c.id}`}
                  className="mt-0.5 size-5 border-slate data-checked:border-primary"
                  checked={ticked.includes(c.id)}
                  onCheckedChange={(on) => setTicked((t) => (on === true ? [...t, c.id] : t.filter((id) => id !== c.id)))}
                />
                {c.label}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || ticked.length < CONFIRM.length} onClick={() => decide("approve")}>
              Approve licence
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setRejecting(true)}>
              Something&apos;s wrong
            </Button>
          </div>
        </>
      )}

      {waiting && rejecting && (
        <div className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate">What should the guest fix?</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as LicenceReason)}
              className="rounded-[14px] bg-board px-3.5 py-3 text-base font-bold text-ink outline-none focus:ring-2 focus:ring-ink"
            >
              {LICENCE_REJECT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => decide("reject")}>
              Ask for new photos
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setRejecting(false)}>
              Back
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
