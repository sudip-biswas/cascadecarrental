"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Action = "approve" | "reject";

/** Accept or decline a booking request. Declining asks first, since the guest's hold is released. */
export function TripActionButtons({
  tripId,
  guestName,
  className,
  children,
}: {
  tripId: string;
  guestName: string;
  className?: string;
  /** Extra controls on the same row, e.g. a message button. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function answer(action: Action) {
    setBusy(action);
    const res = await fetch(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body: { error?: string } = await res.json().catch(() => ({}));
    setBusy(null);
    setConfirming(false);

    if (!res.ok) {
      toast.error(body.error ?? "That didn't work. Try again.");
      // The request may have closed in the meantime, so show the latest state either way.
      router.refresh();
      return;
    }
    toast.success(
      action === "approve" ? `Accepted. ${guestName}'s card has been charged.` : "Declined. The hold on their card is released."
    );
    router.refresh();
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button className="h-[50px] flex-1 text-base" disabled={busy !== null} onClick={() => answer("approve")}>
        {busy === "approve" ? "Accepting…" : "Accept"}
      </Button>
      <Button
        variant="secondary"
        className="h-[50px] flex-1 text-base"
        disabled={busy !== null}
        onClick={() => setConfirming(true)}
      >
        Decline
      </Button>
      {children}

      <Dialog open={confirming} onOpenChange={(open) => !busy && setConfirming(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline {guestName}?</DialogTitle>
            <DialogDescription className="text-[15px] text-slate">
              They won&apos;t be charged, and the dates open up for other guests. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={busy !== null} onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button variant="destructive" disabled={busy !== null} onClick={() => answer("reject")}>
              {busy === "reject" ? "Declining…" : "Decline request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
