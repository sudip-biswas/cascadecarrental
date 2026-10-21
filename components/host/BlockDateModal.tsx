"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { pluralize, toDateKey, zonedInstant } from "@/lib/utils";
import { addDays, daysBetween } from "./days";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One car, or several from the fleet calendar. */
  cars: { id: string; name: string }[];
  /** Pacific date keys, both days included. */
  from: string;
  to: string;
  onBlocked: () => void;
}

/** Confirms a block of whole days, with an optional note only the host sees. */
export function BlockDateModal({ open, onOpenChange, cars, from: initialFrom, to: initialTo, onBlocked }: Props) {
  const today = toDateKey(new Date());
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const days = from && to && to >= from ? daysBetween(from, to) + 1 : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!days) {
      toast.error("The last day can't be before the first.");
      return;
    }
    setSaving(true);
    const results = await Promise.all(
      cars.map(async (car) => {
        const res = await fetch(`/api/vehicles/${car.id}/block`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Whole Pacific days: midnight on the first day to midnight after the last.
            blocked_from: zonedInstant(from, "00:00").toISOString(),
            blocked_to: zonedInstant(addDays(to, 1), "00:00").toISOString(),
            reason: note.trim() || undefined,
          }),
        });
        const body: { error?: string } = await res.json().catch(() => ({}));
        return { car, ok: res.ok, error: body.error };
      })
    );
    setSaving(false);

    const failed = results.filter((r) => !r.ok);
    if (failed.length === cars.length) {
      toast.error(failed[0].error ?? "Couldn't block those days. Try again.");
      return;
    }
    if (failed.length) {
      toast.error(`Couldn't block ${failed.map((r) => r.car.name).join(", ")}. ${failed[0].error ?? ""}`.trim());
    }
    toast.success(
      cars.length === 1
        ? `${pluralize(days, "day")} blocked. Nobody can book them.`
        : `${pluralize(days, "day")} blocked on ${pluralize(cars.length - failed.length, "car")}.`
    );
    setNote("");
    onBlocked();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block days</DialogTitle>
          <DialogDescription className="text-[15px] text-slate">
            {cars.length === 1 ? cars[0].name : pluralize(cars.length, "car")} won&apos;t show as available on
            these days.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-from" className="text-sm font-semibold text-slate">
                First day
              </Label>
              <Input id="block-from" type="date" value={from} min={today} onChange={(e) => setFrom(e.target.value)} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="block-to" className="text-sm font-semibold text-slate">
                Last day
              </Label>
              <Input id="block-to" type="date" value={to} min={from || today} onChange={(e) => setTo(e.target.value)} required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="block-note" className="text-sm font-semibold text-slate">
              Note, only you see it
            </Label>
            <Input
              id="block-note"
              placeholder="Using it myself"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !days}>
              {saving ? "Blocking…" : days ? `Block ${pluralize(days, "day")}` : "Block days"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
