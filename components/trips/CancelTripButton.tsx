"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";

interface Props {
  tripId: string;
  /** From guestCancellation(): what happens to the money, in one line. */
  summary: string;
  refundCents: number;
  /** False while the card is only held, so there's nothing to refund. */
  charged: boolean;
}

export function CancelTripButton({ tripId, summary, refundCents, charged }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/trips/${tripId}/cancel`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't cancel the trip. Try again.");
      return;
    }
    setOpen(false);
    toast.success(
      data.refundCents > 0 ? `Trip cancelled. ${formatCurrency(data.refundCents)} is on its way back.` : "Trip cancelled."
    );
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full text-error hover:bg-error-soft">
          Cancel trip
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Cancel this trip?</DialogTitle>
        <DialogDescription className="text-[15px] text-slate">{summary}</DialogDescription>
        <div className="figures flex items-baseline justify-between rounded-[16px] bg-board px-3.5 py-3">
          <span className="text-[15px] font-semibold">{charged ? "You'd get back" : "Charged so far"}</span>
          <span className="text-[22px] font-extrabold">{formatCurrency(charged ? refundCents : 0)}</span>
        </div>
        {error && (
          <p role="alert" className="rounded-[14px] bg-error-soft px-3.5 py-3 text-[15px] font-semibold text-error">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Keep it</Button>
          </DialogClose>
          <Button variant="destructive" disabled={busy} onClick={cancel}>
            {busy ? "Cancelling…" : "Cancel trip"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
