"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

export function TripActionButtons({ tripId, status }: { tripId: string; status: string }) {
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const router = useRouter();

  async function handleAction(action: "approve" | "reject") {
    setLoading(action);
    const res = await fetch(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setLoading(null);
    if (res.ok) {
      toast.success(action === "approve" ? "Trip approved" : "Trip rejected");
      router.refresh();
    } else {
      const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
      toast.error(error ?? "Action failed");
    }
  }

  if (status !== "pending") return null;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        className="h-7 px-2 bg-alpine-500 hover:bg-alpine-500/90 text-white"
        disabled={loading !== null}
        onClick={() => handleAction("approve")}
      >
        {loading === "approve" ? (
          <span className="text-xs">...</span>
        ) : (
          <Check className="w-3.5 h-3.5" />
        )}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-ember-500 border-ember-500/30 hover:bg-ember-500/10"
        disabled={loading !== null}
        onClick={() => handleAction("reject")}
      >
        {loading === "reject" ? (
          <span className="text-xs">...</span>
        ) : (
          <X className="w-3.5 h-3.5" />
        )}
      </Button>
    </div>
  );
}
