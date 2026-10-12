"use client";

import { useState } from "react";
import { format, addDays } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onClose: () => void;
  vehicleId: string;
  onBlocked: (block: { id: string; vehicle_id: string; blocked_from: string; blocked_to: string; reason: string | null }) => void;
}

export function BlockDateModal({ open, onClose, vehicleId, onBlocked }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (to < from) {
      toast.error("End date must be after start date");
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/vehicles/${vehicleId}/block`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        blocked_from: new Date(from).toISOString(),
        blocked_to: new Date(to + "T23:59:59").toISOString(),
        reason: reason.trim() || undefined,
      }),
    });
    setLoading(false);

    if (res.ok) {
      const { id } = await res.json();
      onBlocked({
        id,
        vehicle_id: vehicleId,
        blocked_from: new Date(from).toISOString(),
        blocked_to: new Date(to + "T23:59:59").toISOString(),
        reason: reason.trim() || null,
      });
      toast.success("Dates blocked");
      onClose();
    } else {
      const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
      toast.error(error ?? "Failed to block dates");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-cascade-700" />
            Block dates
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="block-from">From</Label>
              <Input
                id="block-from"
                type="date"
                value={from}
                min={today}
                onChange={(e) => setFrom(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="block-to">To</Label>
              <Input
                id="block-to"
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="block-reason">Reason (optional)</Label>
            <Input
              id="block-reason"
              placeholder="e.g. Personal use, maintenance..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-cascade-700 hover:bg-cascade-900 text-white"
              disabled={loading}
            >
              {loading ? "Blocking..." : "Block dates"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
