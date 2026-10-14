"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type VehicleUpdate = Database["public"]["Tables"]["vehicles"]["Update"];
type NumericColumn = {
  [K in keyof VehicleUpdate]-?: NonNullable<VehicleUpdate[K]> extends number ? K : never;
}[keyof VehicleUpdate];

export interface EditField {
  column: NumericColumn;
  label: string;
  /** Stored value. Dollar fields are stored in cents. */
  value: number;
  unit: "dollars" | "cents" | "percent" | "miles";
  min: number;
  max: number;
}

const SUFFIX: Record<EditField["unit"], string> = { dollars: "", cents: "¢", percent: "%", miles: "mi" };

const toInput = (f: EditField) => String(f.unit === "dollars" ? f.value / 100 : f.value);
const fromInput = (f: EditField, raw: string) =>
  f.unit === "dollars" ? Math.round(Number(raw) * 100) : Math.round(Number(raw));

/** Small form for a few number settings on a car, e.g. price and discounts. */
export function VehicleEditDialog({
  vehicleId,
  title,
  note,
  fields,
}: {
  vehicleId: string;
  title: string;
  note?: string;
  fields: EditField[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => fields.map(toInput));
  const [saving, setSaving] = useState(false);

  function openDialog() {
    setValues(fields.map(toInput));
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const update: VehicleUpdate = { updated_at: new Date().toISOString() };
    for (const [i, f] of fields.entries()) {
      const stored = fromInput(f, values[i]);
      const shown = f.unit === "dollars" ? { min: f.min / 100, max: f.max / 100 } : f;
      if (values[i].trim() === "" || !Number.isFinite(stored) || stored < f.min || stored > f.max) {
        toast.error(`${f.label} has to be between ${shown.min} and ${shown.max}.`);
        return;
      }
      update[f.column] = stored;
    }

    setSaving(true);
    const { data, error } = await createClient().from("vehicles").update(update).eq("id", vehicleId).select("id");
    setSaving(false);
    if (error || !data?.length) {
      toast.error("Couldn't save that. Try again.");
      return;
    }
    toast.success("Saved. Trips already booked keep their price.");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="xs" variant="outline" className="h-[38px] px-3 text-sm" onClick={openDialog}>
        Edit
      </Button>
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {note && <DialogDescription className="text-[15px] text-slate">{note}</DialogDescription>}
          </DialogHeader>
          <form onSubmit={save} className="flex flex-col gap-4">
            {fields.map((f, i) => (
              <div key={f.column} className="flex flex-col gap-1.5">
                <Label htmlFor={`edit-${f.column}`} className="text-sm font-semibold text-slate">
                  {f.label}
                </Label>
                <div className="flex items-center gap-2">
                  {f.unit === "dollars" && <span className="text-lg font-bold">$</span>}
                  <Input
                    id={`edit-${f.column}`}
                    type="number"
                    inputMode="decimal"
                    step={f.unit === "dollars" ? "0.01" : "1"}
                    value={values[i]}
                    onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                    className="figures text-lg font-bold"
                  />
                  {SUFFIX[f.unit] && <span className="text-base font-semibold text-slate">{SUFFIX[f.unit]}</span>}
                </div>
              </div>
            ))}
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
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
