"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type Decision = "resolved" | "closed";

export function ResolveClaim({ claimId }: { claimId: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!decision) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/claims/${claimId}/resolve`, {
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
    toast.success(decision === "resolved" ? "Claim resolved." : "Claim closed.");
    router.refresh();
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => setDecision("closed")}>
          Close
        </Button>
        <Button onClick={() => setDecision("resolved")}>Resolve</Button>
      </div>

      <Dialog open={decision !== null} onOpenChange={(open) => !open && !busy && setDecision(null)}>
        <DialogContent>
          <DialogTitle>{decision === "resolved" ? "Resolve this claim?" : "Close this claim?"}</DialogTitle>
          <DialogDescription className="text-[15px] text-slate">Both sides get your note. No money moves.</DialogDescription>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={2000}
            placeholder="What was decided, in a sentence or two"
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
            <Button disabled={busy || note.trim().length < 3} onClick={submit}>
              {busy ? "Saving…" : decision === "resolved" ? "Resolve" : "Close"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
