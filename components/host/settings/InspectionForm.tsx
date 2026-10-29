"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { CHECKLIST, CHECKLIST_ITEMS, checklistPassed, type CheckResult } from "@/lib/safety";
import { cn, toDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const RESULTS: { value: CheckResult; label: string; on: string }[] = [
  { value: "pass", label: "OK", on: "bg-mint text-mint-ink" },
  { value: "fail", label: "Needs work", on: "bg-error-soft text-error" },
  { value: "na", label: "N/A", on: "bg-ink text-white" },
];

/** The yearly checklist: every item answered, then saved as passed or failed. */
export function InspectionForm({ vehicleId, lastOdometer }: { vehicleId: string; lastOdometer: number | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, CheckResult>>({});
  const [inspectedOn, setInspectedOn] = useState("");
  const [odometer, setOdometer] = useState("");
  const [inspector, setInspector] = useState("");
  const [notes, setNotes] = useState("");

  const answered = CHECKLIST_ITEMS.filter((i) => checklist[i.id]).length;
  const failed = CHECKLIST_ITEMS.filter((i) => checklist[i.id] === "fail");

  function openDialog() {
    setChecklist({});
    setInspectedOn(toDateKey(new Date()));
    setOdometer(lastOdometer != null ? String(lastOdometer) : "");
    setInspector("");
    setNotes("");
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (answered < CHECKLIST_ITEMS.length) return toast.error(`Answer every item first: ${CHECKLIST_ITEMS.length - answered} to go.`);
    if (failed.length && !notes.trim()) return toast.error("Say what needs work, so it's on record.");
    const miles = odometer.trim() ? Number(odometer) : null;
    if (miles != null && (!Number.isInteger(miles) || miles < 0)) return toast.error("Odometer should be whole miles.");

    setSaving(true);
    const passed = checklistPassed(checklist);
    const { error } = await createClient().from("vehicle_inspections").insert({
      vehicle_id: vehicleId,
      inspected_on: inspectedOn,
      odometer_mi: miles,
      checklist,
      passed,
      inspector: inspector.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error("Couldn't save the inspection. Try again.");
      return;
    }
    setOpen(false);
    toast.success(passed ? "Inspection passed. Next one is due in a year." : "Saved as needing work. Fix it and inspect again.");
    router.refresh();
  }

  return (
    <>
      <Button size="sm" onClick={openDialog}>
        <ClipboardCheck /> Submit inspection
      </Button>
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Inspection</DialogTitle>
            <DialogDescription className="text-[15px] text-slate">
              Walk around the car and answer every item. Anything that needs work fails the inspection until it&apos;s fixed.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-5">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="insp-date" className="text-sm font-semibold text-slate">
                  Date
                </Label>
                <Input
                  id="insp-date"
                  type="date"
                  required
                  max={toDateKey(new Date())}
                  value={inspectedOn}
                  onChange={(e) => setInspectedOn(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="insp-odo" className="text-sm font-semibold text-slate">
                  Odometer (mi)
                </Label>
                <Input id="insp-odo" inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value.replace(/\D/g, ""))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="insp-who" className="text-sm font-semibold text-slate">
                  Done by
                </Label>
                <Input id="insp-who" maxLength={120} placeholder="You, or the shop" value={inspector} onChange={(e) => setInspector(e.target.value)} />
              </div>
            </div>

            {CHECKLIST.map((group) => (
              <fieldset key={group.group} className="flex flex-col gap-2">
                <legend className="mb-1 text-lg font-extrabold">{group.group}</legend>
                {group.items.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[16px] bg-board px-3.5 py-2.5">
                    <span className="min-w-0 flex-[1_1_200px]">
                      <span className="block text-[15px] font-bold">{item.label}</span>
                      {item.help && <span className="block text-[13px] text-slate">{item.help}</span>}
                    </span>
                    <span role="radiogroup" aria-label={item.label} className="flex gap-1">
                      {RESULTS.map((r) => {
                        const on = checklist[item.id] === r.value;
                        return (
                          <button
                            key={r.value}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setChecklist((c) => ({ ...c, [item.id]: r.value }))}
                            className={cn(
                              "rounded-[10px] px-2.5 py-1.5 text-[13px] font-bold transition-colors",
                              on ? r.on : "bg-white text-slate hover:text-ink"
                            )}
                          >
                            {r.label}
                          </button>
                        );
                      })}
                    </span>
                  </div>
                ))}
              </fieldset>
            ))}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="insp-notes" className="text-sm font-semibold text-slate">
                {failed.length ? "What needs work" : "Notes"}
              </Label>
              <Textarea
                id="insp-notes"
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={failed.length ? "E.g. rear left tire at 3/32 in., booked for Thursday" : "Anything worth remembering"}
              />
            </div>

            <div className="flex flex-col-reverse items-stretch gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end">
              <span className="figures text-sm font-semibold text-slate sm:mr-auto">
                {answered} of {CHECKLIST_ITEMS.length} answered
                {failed.length ? ` · ${failed.length} need${failed.length === 1 ? "s" : ""} work` : ""}
              </span>
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save inspection"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
