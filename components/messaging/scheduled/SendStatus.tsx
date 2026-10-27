"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setScheduledStatus } from "@/app/(host)/host/inbox/scheduled/actions";

/** Scheduled / Skipped for one trip's message, like a status menu. */
export function SendStatus({ id, status }: { id: string; status: "scheduled" | "skipped" }) {
  const [value, setValue] = useState(status);
  const [pending, start] = useTransition();

  function change(next: "scheduled" | "skipped") {
    const before = value;
    setValue(next);
    start(async () => {
      const { error } = await setScheduledStatus(id, next);
      if (error) {
        setValue(before);
        toast.error(error);
      } else {
        toast.success(next === "skipped" ? "Skipped. This guest won't get it." : "Back on. It goes out as planned.");
      }
    });
  }

  return (
    <select
      aria-label="Status"
      value={value}
      disabled={pending}
      onChange={(e) => change(e.target.value as "scheduled" | "skipped")}
      className={cn(
        "h-[38px] cursor-pointer rounded-[10px] px-3 text-[15px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-60",
        value === "skipped" ? "bg-peach text-peach-ink" : "bg-board hover:bg-line"
      )}
    >
      <option value="scheduled">Scheduled</option>
      <option value="skipped">Skipped</option>
    </select>
  );
}
