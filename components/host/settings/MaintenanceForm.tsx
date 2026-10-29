"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { VehicleMaintenance } from "@/lib/supabase/types";
import { MAINTENANCE_KINDS, TYPICAL_INTERVAL, monthsAfter } from "@/lib/safety";
import { toDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Kind = VehicleMaintenance["kind"];

const digits = (s: string) => s.replace(/\D/g, "");

/** Log work done on the car, and optionally when it's next due. */
export function MaintenanceForm({ vehicleId, lastOdometer }: { vehicleId: string; lastOdometer: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState<Kind>("oil_change");
  const [doneOn, setDoneOn] = useState("");
  const [odometer, setOdometer] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [nextOn, setNextOn] = useState("");
  const [nextMi, setNextMi] = useState("");

  // Fill in when it's next due from the usual interval, which the host can change.
  function suggest(k: Kind, on: string, miles: string) {
    const typical = TYPICAL_INTERVAL[k];
    setNextOn(typical?.months && on ? monthsAfter(on, typical.months) : "");
    setNextMi(typical?.miles && miles ? String(Number(miles) + typical.miles) : "");
  }

  function openDialog() {
    const today = toDateKey(new Date());
    const miles = lastOdometer != null ? String(lastOdometer) : "";
    setKind("oil_change");
    setDoneOn(today);
    setOdometer(miles);
    setCost("");
    setNotes("");
    suggest("oil_change", today, miles);
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const costCents = cost.trim() ? Math.round(Number(cost) * 100) : null;
    if (costCents != null && (!Number.isFinite(costCents) || costCents < 0)) return toast.error("Cost should be a dollar amount.");
    if (nextOn && nextOn <= doneOn) return toast.error("The next one should be after this one.");

    setSaving(true);
    const { error } = await createClient()
      .from("vehicle_maintenance")
      .insert({
        vehicle_id: vehicleId,
        kind,
        done_on: doneOn,
        odometer_mi: odometer ? Number(odometer) : null,
        cost_cents: costCents,
        notes: notes.trim() || null,
        next_due_on: nextOn || null,
        next_due_mi: nextMi ? Number(nextMi) : null,
      });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save that. Try again.");
      return;
    }
    setOpen(false);
    toast.success(`${MAINTENANCE_KINDS[kind]} logged.`);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant="secondary" onClick={openDialog}>
        <Wrench /> Log work
      </Button>
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log work</DialogTitle>
            <DialogDescription className="text-[15px] text-slate">
              Keep a record of what was done. Set when it&apos;s next due and the car page reminds you.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate">What was done</span>
              <select
                value={kind}
                onChange={(e) => {
                  const k = e.target.value as Kind;
                  setKind(k);
                  suggest(k, doneOn, odometer);
                }}
                className="rounded-[14px] bg-board px-3.5 py-3 text-base font-bold text-ink outline-none focus:ring-2 focus:ring-ink"
              >
                {(Object.keys(MAINTENANCE_KINDS) as Kind[]).map((k) => (
                  <option key={k} value={k}>
                    {MAINTENANCE_KINDS[k]}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mx-date" className="text-sm font-semibold text-slate">
                  Date
                </Label>
                <Input
                  id="mx-date"
                  type="date"
                  required
                  max={toDateKey(new Date())}
                  value={doneOn}
                  onChange={(e) => {
                    setDoneOn(e.target.value);
                    suggest(kind, e.target.value, odometer);
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mx-odo" className="text-sm font-semibold text-slate">
                  Odometer (mi)
                </Label>
                <Input
                  id="mx-odo"
                  inputMode="numeric"
                  value={odometer}
                  onChange={(e) => {
                    setOdometer(digits(e.target.value));
                    suggest(kind, doneOn, digits(e.target.value));
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mx-cost" className="text-sm font-semibold text-slate">
                  Cost ($)
                </Label>
                <Input id="mx-cost" inputMode="decimal" placeholder="Optional" value={cost} onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ""))} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mx-notes" className="text-sm font-semibold text-slate">
                Notes
              </Label>
              <Textarea id="mx-notes" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shop, parts, anything to remember" />
            </div>
            <fieldset className="flex flex-col gap-2 rounded-[18px] bg-board p-3.5">
              <legend className="sr-only">Next due</legend>
              <span className="text-[15px] font-extrabold">Next due</span>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mx-next-on" className="text-sm font-semibold text-slate">
                    By date
                  </Label>
                  <Input id="mx-next-on" type="date" className="bg-white" value={nextOn} onChange={(e) => setNextOn(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mx-next-mi" className="text-sm font-semibold text-slate">
                    By odometer (mi)
                  </Label>
                  <Input id="mx-next-mi" inputMode="numeric" className="bg-white" value={nextMi} onChange={(e) => setNextMi(digits(e.target.value))} />
                </div>
              </div>
              <span className="text-[13px] text-slate">Whichever comes first. Leave both empty if it isn&apos;t recurring.</span>
            </fieldset>
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Removes a mistaken entry from the log. */
export function DeleteMaintenance({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="icon-xs"
      variant="ghost"
      aria-label={`Remove ${label}`}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const { error } = await createClient().from("vehicle_maintenance").delete().eq("id", id);
        setBusy(false);
        if (error) return toast.error("Couldn't remove that. Try again.");
        router.refresh();
      }}
    >
      <Trash2 />
    </Button>
  );
}
