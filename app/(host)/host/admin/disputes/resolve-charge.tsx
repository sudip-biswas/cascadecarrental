"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

type Decision = "charge" | "decline";

export function ResolveCharge({ chargeId, amountCents, guest }: { chargeId: string; amountCents: number; guest: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amount = formatCurrency(amountCents);

  async function submit() {
    if (!decision) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/charges/${chargeId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, note }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't save that. Try again.");
      router.refresh();
      return;
    }
    setDecision(null);
    setNote("");
    toast.success(decision === "charge" ? `${guest} was charged ${amount}.` : "Charge declined.");
    router.refresh();
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="destructive" onClick={() => setDecision("decline")}>
          Decline the charge
        </Button>
        <Button onClick={() => setDecision("charge")}>Charge the guest</Button>
      </div>

      <Dialog open={decision !== null} onOpenChange={(open) => !open && !busy && setDecision(null)}>
        <DialogContent>
          <DialogTitle>{decision === "charge" ? `Charge ${guest} ${amount}?` : "Decline this charge?"}</DialogTitle>
          <DialogDescription className="text-[15px] text-slate">
            {decision === "charge"
              ? "We take it from the deposit if there's one held, or the card on file. Both sides get your note."
              : "The guest won't pay anything. Both sides get your note."}
          </DialogDescription>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            placeholder="Why, in a sentence or two"
            aria-label="Note to both sides"
          />
          {error && (
            <p role="alert" className="rounded-[14px] bg-error-soft px-3.5 py-3 text-[15px] font-semibold text-error">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <DialogClose asChild>
              <Button variant="secondary" disabled={busy}>
                Back
              </Button>
            </DialogClose>
            <Button variant={decision === "charge" ? "default" : "destructive"} disabled={busy} onClick={submit}>
              {busy ? "Saving…" : decision === "charge" ? `Charge ${amount}` : "Decline"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
