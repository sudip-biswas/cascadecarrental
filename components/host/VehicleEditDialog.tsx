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
import { Switch } from "@/components/host/settings/Switch";

type VehicleUpdate = Database["public"]["Tables"]["vehicles"]["Update"];
type NumericColumn = {
  [K in keyof VehicleUpdate]-?: NonNullable<VehicleUpdate[K]> extends number ? K : never;
}[keyof VehicleUpdate];
type BooleanColumn = {
  [K in keyof VehicleUpdate]-?: NonNullable<VehicleUpdate[K]> extends boolean ? K : never;
}[keyof VehicleUpdate];
type NullableColumn = {
  [K in NumericColumn]-?: null extends VehicleUpdate[K] ? K : never;
}[NumericColumn];

interface NumberField {
  kind?: "number";
  column: NumericColumn;
  label: string;
  /** Stored value. Dollar fields are stored in cents. */
  value: number;
  unit: "dollars" | "cents" | "percent" | "miles" | "years";
  min: number;
  max: number;
}

/** A number the host can switch off, which stores null, e.g. the airport delivery fee. */
interface OptionalNumberField extends Omit<NumberField, "kind" | "column" | "value"> {
  kind: "optional";
  column: NullableColumn;
  value: number | null;
  /** Switch label, e.g. "Deliver to the airport". */
  toggleLabel: string;
}

interface ToggleField {
  kind: "toggle";
  column: BooleanColumn;
  label: string;
  value: boolean;
}

export type EditField = NumberField | OptionalNumberField | ToggleField;
type NumericField = NumberField | OptionalNumberField;

const SUFFIX: Record<NumberField["unit"], string> = { dollars: "", cents: "¢", percent: "%", miles: "mi", years: "years old" };

const toInput = (f: EditField) => {
  if (f.kind === "toggle") return "";
  const value = f.value ?? f.min;
  return String(f.unit === "dollars" ? value / 100 : value);
};
const fromInput = (f: NumericField, raw: string) =>
  f.unit === "dollars" ? Math.round(Number(raw) * 100) : Math.round(Number(raw));
const isOn = (f: EditField) => (f.kind === "toggle" ? f.value : f.kind === "optional" ? f.value != null : true);

/** Small form for a few settings on a car, e.g. price and discounts, or delivery on/off. */
export function VehicleEditDialog({
  vehicleId,
  title,
  note,
  fields,
  saved = "Saved. Trips already booked keep their price.",
}: {
  vehicleId: string;
  title: string;
  note?: string;
  fields: EditField[];
  /** Toast after a save. */
  saved?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(() => fields.map(toInput));
  const [on, setOn] = useState(() => fields.map(isOn));
  const [saving, setSaving] = useState(false);

  function openDialog() {
    setValues(fields.map(toInput));
    setOn(fields.map(isOn));
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const update: Record<string, number | boolean | null> = {};
    for (const [i, f] of fields.entries()) {
      if (f.kind === "toggle") {
        update[f.column] = on[i];
        continue;
      }
      if (f.kind === "optional" && !on[i]) {
        update[f.column] = null;
        continue;
      }
      const stored = fromInput(f, values[i]);
      const shown = f.unit === "dollars" ? { min: f.min / 100, max: f.max / 100 } : f;
      if (values[i].trim() === "" || !Number.isFinite(stored) || stored < f.min || stored > f.max) {
        toast.error(`${f.label} has to be between ${shown.min} and ${shown.max}.`);
        return;
      }
      update[f.column] = stored;
    }

    setSaving(true);
    const { data, error } = await createClient()
      .from("vehicles")
      .update({ ...(update as VehicleUpdate), updated_at: new Date().toISOString() })
      .eq("id", vehicleId)
      .select("id");
    setSaving(false);
    if (error || !data?.length) {
      toast.error("Couldn't save that. Try again.");
      return;
    }
    toast.success(saved);
    setOpen(false);
    router.refresh();
  }

  function numberInput(f: NumericField, i: number) {
    return (
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
        {SUFFIX[f.unit] && <span className="shrink-0 text-base font-semibold text-slate">{SUFFIX[f.unit]}</span>}
      </div>
    );
  }

  const flip = (i: number, next: boolean) => setOn((o) => o.map((x, j) => (j === i ? next : x)));

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
            {fields.map((f, i) =>
              f.kind === "toggle" ? (
                <Switch key={f.column} checked={on[i]} onChange={(next) => flip(i, next)} label={f.label} className="self-start" />
              ) : f.kind === "optional" ? (
                <div key={f.column} className="flex flex-col gap-2.5">
                  <Switch checked={on[i]} onChange={(next) => flip(i, next)} label={f.toggleLabel} className="self-start" />
                  {on[i] && (
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`edit-${f.column}`} className="text-sm font-semibold text-slate">
                        {f.label}
                      </Label>
                      {numberInput(f, i)}
                    </div>
                  )}
                </div>
              ) : (
                <div key={f.column} className="flex flex-col gap-1.5">
                  <Label htmlFor={`edit-${f.column}`} className="text-sm font-semibold text-slate">
                    {f.label}
                  </Label>
                  {numberInput(f, i)}
                </div>
              )
            )}
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
