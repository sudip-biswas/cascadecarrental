"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Marks a report sorted, or reopens it. */
export function ReportToggle({ reportId, open }: { reportId: string; open: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/admin/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: open ? "resolved" : "open" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't save. Try again.");
      return;
    }
    toast.success(open ? "Marked as sorted." : "Reopened.");
    router.refresh();
  }

  return (
    <Button size="sm" variant={open ? "default" : "secondary"} disabled={busy} onClick={toggle}>
      {open ? "Mark sorted" : "Reopen"}
    </Button>
  );
}
