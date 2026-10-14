"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Accept or decline a booking request from inside the conversation. */
export function RequestActions({ tripId }: { tripId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"approve" | "reject" | null>(null);

  async function answer(action: "approve" | "reject") {
    setPending(action);
    const res = await fetch(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json: { error?: string } = await res.json().catch(() => ({}));
    setPending(null);
    if (!res.ok) {
      toast.error(json.error ?? "That didn't work. Try again.");
      return;
    }
    toast.success(action === "approve" ? "Accepted. The guest's card was charged." : "Declined. The hold on their card is released.");
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" className="h-[46px] px-[18px]" disabled={pending !== null} onClick={() => answer("approve")}>
        {pending === "approve" ? "Accepting…" : "Accept"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-[46px] px-4"
        disabled={pending !== null}
        onClick={() => answer("reject")}
      >
        {pending === "reject" ? "Declining…" : "Decline"}
      </Button>
    </div>
  );
}
