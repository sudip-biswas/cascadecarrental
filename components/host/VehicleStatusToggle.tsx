"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function VehicleStatusToggle({
  vehicleId,
  currentStatus,
}: {
  vehicleId: string;
  currentStatus: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const isListed = currentStatus === "listed";

  async function toggle() {
    setLoading(true);
    const newStatus = isListed ? "unlisted" : "listed";
    const { error } = await supabase
      .from("vehicles")
      .update({ status: newStatus })
      .eq("id", vehicleId);
    setLoading(false);

    if (error) {
      toast.error("Failed to update listing status");
    } else {
      toast.success(newStatus === "listed" ? "Listing is now live" : "Listing paused");
      router.refresh();
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={toggle}
      className={
        isListed
          ? "text-ember-500 border-ember-500/30 hover:bg-ember-500/10"
          : "text-alpine-500 border-alpine-500/30 hover:bg-alpine-500/10"
      }
    >
      {loading ? "..." : isListed ? "Unlist" : "List"}
    </Button>
  );
}
