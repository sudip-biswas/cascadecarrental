"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Action = "accept" | "decline" | "cancel";

const DONE: Record<Action, string> = {
  accept: "Change accepted. The trip has its new times.",
  decline: "Change declined. The trip stays as it was.",
  cancel: "Request taken back.",
};

/** Accept or decline for the host; take it back for the guest. */
export function ChangeActions({ tripId, changeId, viewer }: { tripId: string; changeId: string; viewer: "guest" | "host" }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(action: Action) {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/trips/${tripId}/changes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeId, action }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      const message = data.error ?? "Something went wrong. Try again.";
      setError(message);
      // The panel can close under us (say the change failed), so say it in a toast too.
      toast.error(message);
      router.refresh();
      return;
    }
    toast.success(DONE[action]);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="rounded-[14px] bg-error-soft px-3.5 py-3 text-[15px] font-semibold text-error">
          {error}
        </p>
      )}
      {viewer === "host" ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={!!busy} onClick={() => send("decline")}>
            {busy === "decline" ? "Declining…" : "Decline"}
          </Button>
          <Button disabled={!!busy} onClick={() => send("accept")}>
            {busy === "accept" ? "Accepting…" : "Accept"}
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="self-start" disabled={!!busy} onClick={() => send("cancel")}>
          {busy ? "Taking it back…" : "Take back request"}
        </Button>
      )}
    </div>
  );
}
