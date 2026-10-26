"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

async function send(tripId: string, body: { chargeId: string; action: "pay" | "dispute" | "cancel"; note?: string }) {
  const res = await fetch(`/api/trips/${tripId}/charges`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const data = (await res?.json().catch(() => null)) ?? {};
  return { ok: !!res?.ok, error: data.error as string | undefined, message: data.message as string | undefined };
}

/** The guest's Pay and Dispute buttons on one charge. */
export function GuestChargeActions({
  tripId,
  chargeId,
  amountCents,
  canDispute,
}: {
  tripId: string;
  chargeId: string;
  amountCents: number;
  canDispute: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setBusy(true);
    const res = await send(tripId, { chargeId, action: "pay" });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't pay it. Try again.");
      router.refresh();
      return;
    }
    toast.success(res.message ?? "Paid.");
    router.refresh();
  }

  async function dispute() {
    setBusy(true);
    setError(null);
    const res = await send(tripId, { chargeId, action: "dispute", note: note.trim() });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't send it. Try again.");
      return;
    }
    setOpen(false);
    toast.success("Sent. Cascade will look at it and get back to you both.");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={busy} onClick={pay}>
        {busy ? "Working…" : `Pay ${formatCurrency(amountCents)}`}
      </Button>
      {canDispute && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={busy}>
              Dispute
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>What&apos;s wrong with this charge?</DialogTitle>
            <DialogDescription className="text-[15px] text-slate">
              Cascade looks at the photos and both sides, then decides. Nothing is charged until then.
            </DialogDescription>
            <Textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              placeholder="Say what happened, e.g. the tank was full when I dropped it off."
            />
            {error && (
              <p role="alert" className="rounded-[14px] bg-error-soft px-3.5 py-3 text-[15px] font-semibold text-error">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <DialogClose asChild>
                <Button variant="secondary">Never mind</Button>
              </DialogClose>
              <Button disabled={busy || note.trim().length < 3} onClick={dispute}>
                {busy ? "Sending…" : "Send dispute"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

/** The host takes back a charge nobody has paid yet. */
export function CancelChargeButton({ tripId, chargeId }: { tripId: string; chargeId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    const res = await send(tripId, { chargeId, action: "cancel" });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't take it back. Try again.");
      return;
    }
    toast.success("Charge withdrawn.");
    router.refresh();
  }

  return (
    <Button size="sm" variant="ghost" disabled={busy} onClick={cancel} className="self-start">
      {busy ? "Withdrawing…" : "Withdraw"}
    </Button>
  );
}
