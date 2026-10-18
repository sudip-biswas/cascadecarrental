"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Starts Stripe Connect Express onboarding by POSTing to /api/connect/onboard. */
export function ConnectPayoutsButton() {
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      const res = await fetch("/api/connect/onboard", { method: "POST" });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.location.href = url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setLoading(false);
    }
  }

  return (
    <Button onClick={start} disabled={loading} className="shrink-0">
      {loading ? "Redirecting…" : "Connect bank account"}
    </Button>
  );
}

/** Opens the Stripe Express dashboard for an existing Connect account. */
export function ManagePayoutsButton() {
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    try {
      const res = await fetch("/api/connect/onboard");
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      window.open(url, "_blank");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="secondary" onClick={open} disabled={loading} className="shrink-0 gap-2">
      <ExternalLink className="size-4" />
      {loading ? "Opening…" : "Manage payouts"}
    </Button>
  );
}
