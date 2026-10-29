"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Vehicle } from "@/lib/supabase/types";
import { LIMITS } from "@/lib/listing-limits";
import { cn, pluralize } from "@/lib/utils";

/** Listed / unlisted switch. Flips straight away and rolls back if the save fails. */
export function VehicleStatusToggle({
  vehicleId,
  status: initial,
  photoCount,
  inspectionOverdue = false,
}: {
  vehicleId: string;
  status: Vehicle["status"];
  photoCount: number;
  /** An unlisted car with an overdue inspection can't be listed until a passing one is in. */
  inspectionOverdue?: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [saving, setSaving] = useState(false);

  if (status === "suspended") {
    return (
      <span className="rounded-[14px] bg-error-soft px-3.5 py-2.5 text-[15px] font-bold text-error">
        Suspended by Cascade, so it can&apos;t be listed right now
      </span>
    );
  }

  const listed = status === "listed";
  const photosNeeded = LIMITS.photosToList - photoCount;

  if (!listed && photosNeeded > 0) {
    return (
      <span className="rounded-[14px] bg-butter px-3.5 py-2.5 text-[15px] font-bold text-butter-ink">
        Add {pluralize(photosNeeded, "more photo")} to list it
      </span>
    );
  }

  if (!listed && inspectionOverdue) {
    return (
      <a href="#safety" className="rounded-[14px] bg-error-soft px-3.5 py-2.5 text-[15px] font-bold text-error">
        Inspection overdue: submit one to list it
      </a>
    );
  }

  async function toggle() {
    const next = listed ? "unlisted" : "listed";
    setStatus(next);
    setSaving(true);
    const { data, error } = await createClient()
      .from("vehicles")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", vehicleId)
      .select("id");
    setSaving(false);

    // No row back means row security refused it, e.g. the car was suspended meanwhile.
    if (error || !data?.length) {
      setStatus(status);
      toast.error(
        error?.message.includes("inspection_overdue")
          ? "The yearly inspection is overdue. Submit a passing one to list it."
          : "Couldn't change that. Try again."
      );
      return;
    }
    toast.success(next === "listed" ? "Listed. It shows in search again." : "Unlisted. Guests can't find or book it.");
    router.refresh();
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={listed}
      disabled={saving}
      onClick={toggle}
      className={cn(
        "flex items-center gap-2.5 rounded-[14px] px-3.5 py-2.5 text-[15px] font-bold transition-colors disabled:opacity-70",
        listed ? "bg-mint text-ink" : "bg-board text-ink hover:bg-line"
      )}
    >
      <span className={cn("relative inline-block h-[26px] w-11 rounded-[9px] transition-colors", listed ? "bg-ink" : "bg-[#c9ccd3]")}>
        <span
          className={cn(
            "absolute top-[3px] size-5 rounded-[7px] bg-white transition-[left]",
            listed ? "left-[21px]" : "left-[3px]"
          )}
        />
      </span>
      {listed ? "Listed" : "Unlisted"}
    </button>
  );
}
