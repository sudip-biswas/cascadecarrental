"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

function toCents(dollars: string) {
  const n = Number(dollars.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-[14px] bg-error-soft px-3.5 py-3 text-[15px] font-semibold text-error">
      {children}
    </p>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button type="button" variant={on ? "default" : "secondary"} onClick={onClick}>
      {children}
    </Button>
  );
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

/** Full or partial refund. `leftCents` is null when Stripe couldn't be reached; the server checks again anyway. */
export function RefundButton({ tripId, leftCents }: { tripId: string; leftCents: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(true);
  const [dollars, setDollars] = useState("");
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = full && leftCents != null ? leftCents : toCents(dollars);
  const valid = Number.isInteger(amountCents) && amountCents > 0 && (leftCents == null || amountCents <= leftCents);

  function onOpenChange(next: boolean) {
    if (busy) return;
    if (next) {
      setRequestId(crypto.randomUUID());
      setFull(leftCents != null);
      setDollars("");
      setNote("");
      setError(null);
    }
    setOpen(next);
  }

  async function refund() {
    setBusy(true);
    setError(null);
    const { ok, data } = await post(`/api/admin/trips/${tripId}/refund`, { amountCents, requestId, note });
    setBusy(false);
    if (!ok) {
      setError(data.error ?? "Couldn't refund. Try again.");
      return;
    }
    setOpen(false);
    toast.success(`Refunded ${formatCurrency(data.refundedCents)}.`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={leftCents === 0}>
          Refund the guest
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Refund the guest</DialogTitle>
        <DialogDescription className="text-[15px] text-slate">
          The money goes back to their card. The trip itself stays as it is.
        </DialogDescription>
        {leftCents != null && (
          <div className="grid grid-cols-2 gap-2">
            <Choice on={full} onClick={() => setFull(true)}>
              All {formatCurrency(leftCents)}
            </Choice>
            <Choice on={!full} onClick={() => setFull(false)}>
              Part of it
            </Choice>
          </div>
        )}
        {(!full || leftCents == null) && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="refund-amount">Amount in dollars</Label>
            <Input id="refund-amount" inputMode="decimal" value={dollars} onChange={(e) => setDollars(e.target.value)} placeholder="25.00" />
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="refund-note">Note to the guest (optional)</Label>
          <Input id="refund-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Sorry about the AC." />
        </div>
        {error && <Alert>{error}</Alert>}
        <div className="grid grid-cols-2 gap-2">
          <DialogClose asChild>
            <Button variant="secondary" disabled={busy}>
              Back
            </Button>
          </DialogClose>
          <Button disabled={busy || !valid} onClick={refund}>
            {busy ? "Refunding…" : valid ? `Refund ${formatCurrency(amountCents)}` : "Refund"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Cancels on Cascade's behalf. A held card is released; a charged one refunds what's chosen. */
export function CancelButton({ tripId, charged, leftCents }: { tripId: string; charged: boolean; leftCents: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<"refunded" | "byHost">("refunded");
  const [full, setFull] = useState(true);
  const [dollars, setDollars] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refundCents = !charged ? 0 : full && leftCents != null ? leftCents : toCents(dollars);
  const valid = Number.isInteger(refundCents) && refundCents >= 0 && (leftCents == null || refundCents <= leftCents);

  async function cancel() {
    setBusy(true);
    setError(null);
    const { ok, data } = await post(`/api/admin/trips/${tripId}/cancel`, { refundCents, reason });
    setBusy(false);
    if (!ok) {
      setError(data.error ?? "Couldn't cancel. Try again.");
      return;
    }
    setOpen(false);
    toast.success(data.refundCents > 0 ? `Cancelled and refunded ${formatCurrency(data.refundCents)}.` : "Trip cancelled.");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="destructive">Cancel the trip</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Cancel this trip?</DialogTitle>
        <DialogDescription className="text-[15px] text-slate">
          {charged
            ? "Both sides are told and the dates open up again."
            : "Nothing was charged yet, so the hold on the guest's card is released. Both sides are told."}
        </DialogDescription>
        <div className="flex flex-col gap-1.5">
          <span className="text-[14px] font-bold">Whose cancellation is it?</span>
          <div className="grid grid-cols-2 gap-2">
            <Choice on={reason === "refunded"} onClick={() => setReason("refunded")}>
              Cascade&apos;s
            </Choice>
            <Choice on={reason === "byHost"} onClick={() => setReason("byHost")}>
              The host&apos;s
            </Choice>
          </div>
        </div>
        {charged && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[14px] font-bold">Refund</span>
            {leftCents != null && (
              <div className="grid grid-cols-2 gap-2">
                <Choice on={full} onClick={() => setFull(true)}>
                  All {formatCurrency(leftCents)}
                </Choice>
                <Choice on={!full} onClick={() => setFull(false)}>
                  Some or none
                </Choice>
              </div>
            )}
            {(!full || leftCents == null) && (
              <Input inputMode="decimal" aria-label="Refund in dollars" value={dollars} onChange={(e) => setDollars(e.target.value)} placeholder="0.00" />
            )}
          </div>
        )}
        {error && <Alert>{error}</Alert>}
        <div className="grid grid-cols-2 gap-2">
          <DialogClose asChild>
            <Button variant="secondary" disabled={busy}>
              Keep it
            </Button>
          </DialogClose>
          <Button variant="destructive" disabled={busy || !valid} onClick={cancel}>
            {busy ? "Cancelling…" : charged && refundCents > 0 ? `Cancel, refund ${formatCurrency(refundCents)}` : "Cancel trip"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
