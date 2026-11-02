"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Mode = "idle" | "rejecting";

/**
 * Approve / reject buttons for the host's check-in review panel.
 */
export function CheckinReviewForm({
  tripId,
  currentStatus,
}: {
  tripId: string;
  currentStatus: "pending" | "approved" | "rejected";
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function decide(decision: "approved" | "rejected") {
    setBusy(true);
    const res = await fetch(`/api/trips/${tripId}/checkin/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, notes: notes.trim() || undefined }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res?.ok) {
      toast.error(body?.error ?? "Couldn't save your decision. Try again.");
      return;
    }
    router.refresh();
  }

  if (currentStatus === "approved") {
    return <p className="text-sm font-semibold text-mint-ink">Approved — guest is cleared to pick up.</p>;
  }

  if (mode === "rejecting") {
    return (
      <div className="flex flex-col gap-2">
        <Textarea
          placeholder="Tell the guest why (optional — shown to them)…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={3}
          disabled={busy}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="destructive" onClick={() => decide("rejected")} disabled={busy}>
            {busy ? "Saving…" : "Send rejection"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("idle")} disabled={busy}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // idle mode: pending or already-rejected (can approve or re-reject)
  return (
    <div className="flex flex-col gap-2">
      {currentStatus === "rejected" && (
        <p className="text-sm text-slate">You rejected this check-in. The guest can resubmit.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => decide("approved")} disabled={busy}>
          {busy ? "Saving…" : currentStatus === "rejected" ? "Approve anyway" : "Approve"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMode("rejecting")} disabled={busy}>
          {currentStatus === "rejected" ? "Reject again" : "Reject"}
        </Button>
      </div>
    </div>
  );
}
