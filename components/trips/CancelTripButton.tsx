"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CancelTripButton({ tripId }: { tripId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this trip?")) return;
    setLoading(true);
    const res = await fetch(`/api/trips/${tripId}/cancel`, { method: "POST" });
    setLoading(false);
    if (res.ok) {
      toast.success("Trip cancelled");
      router.refresh();
    } else {
      const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
      toast.error(error ?? "Failed to cancel trip");
    }
  }

  return (
    <Button
      variant="outline"
      className="w-full text-ember-500 border-ember-500/30 hover:bg-ember-500/10"
      disabled={loading}
      onClick={handleCancel}
    >
      {loading ? "Cancelling..." : "Cancel trip"}
    </Button>
  );
}
