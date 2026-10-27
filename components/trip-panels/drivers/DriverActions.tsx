"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Action = "approve" | "decline" | "remove";

const DONE: Record<Action, (name: string) => string> = {
  approve: (name) => `${name} is approved to drive.`,
  decline: (name) => `${name} is declined. The guest will hear from us.`,
  remove: (name) => `${name} is off the trip.`,
};

/**
 * Approve or decline for the host, remove for the guest. `actions` picks
 * which buttons show, so an approved driver can still be declined.
 */
export function DriverActions({
  tripId,
  driverId,
  name,
  actions,
}: {
  tripId: string;
  driverId: string;
  name: string;
  actions: Action[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);

  async function send(action: Action) {
    setBusy(action);
    const res = await fetch(`/api/trips/${tripId}/drivers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId, action }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(null);
    if (!res?.ok) {
      toast.error(data?.error ?? "Something went wrong. Try again.");
      router.refresh();
      return;
    }
    toast.success(DONE[action](name));
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {actions.includes("decline") && (
        <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => send("decline")}>
          {busy === "decline" ? "Declining…" : "Decline"}
        </Button>
      )}
      {actions.includes("approve") && (
        <Button size="sm" disabled={!!busy} onClick={() => send("approve")}>
          {busy === "approve" ? "Approving…" : "Approve"}
        </Button>
      )}
      {actions.includes("remove") && (
        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => send("remove")}>
          {busy === "remove" ? "Removing…" : "Remove"}
        </Button>
      )}
    </div>
  );
}
