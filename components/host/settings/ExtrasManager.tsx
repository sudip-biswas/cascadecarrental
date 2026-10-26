"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { VehicleExtra } from "@/lib/supabase/types";
import { cn, formatPrice } from "@/lib/utils";
import { Tag } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/host/settings/Switch";

type Draft = Pick<VehicleExtra, "name" | "description" | "price_cents" | "per" | "max_quantity" | "unlimited_miles">;

/** Common extras a host can add in one tap. They can edit the price after. */
const PRESETS: Draft[] = [
  { name: "Child seat", description: "A car seat or booster. Say the child's age when you book.", price_cents: 1000, per: "day", max_quantity: 2, unlimited_miles: false },
  { name: "Prepaid fuel", description: "Bring it back at any fuel level. No stop for gas.", price_cents: 6000, per: "trip", max_quantity: 1, unlimited_miles: false },
  { name: "Unlimited miles", description: "Drive as far as you like with no extra mile fees.", price_cents: 2500, per: "day", max_quantity: 1, unlimited_miles: true },
  { name: "Cooler", description: "A cooler for drinks and snacks.", price_cents: 1000, per: "trip", max_quantity: 1, unlimited_miles: false },
  { name: "Ski rack", description: "Roof rack for skis or snowboards.", price_cents: 1500, per: "day", max_quantity: 1, unlimited_miles: false },
  { name: "Phone mount", description: "A dash mount for maps.", price_cents: 500, per: "trip", max_quantity: 1, unlimited_miles: false },
];

const BLANK: Draft = { name: "", description: "", price_cents: 1000, per: "trip", max_quantity: 1, unlimited_miles: false };

const sorted = (list: VehicleExtra[]) => [...list].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));

export const extraPrice = (e: Pick<VehicleExtra, "price_cents" | "per">) =>
  e.price_cents === 0 ? "Free" : `${formatPrice(e.price_cents)} ${e.per === "day" ? "a day" : "a trip"}`;

/** Add, edit, reorder, switch off and delete the extras guests can add to a trip. */
export function ExtrasManager({ vehicleId, initialExtras }: { vehicleId: string; initialExtras: VehicleExtra[] }) {
  const [extras, setExtras] = useState(() => sorted(initialExtras));
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // null: closed, "new": adding, otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null);

  const taken = new Set(extras.map((e) => e.name.trim().toLowerCase()));
  const presets = PRESETS.filter((p) => !taken.has(p.name.toLowerCase()));
  const nextPosition = extras.reduce((max, e) => Math.max(max, e.position + 1), 0);

  async function add(draft: Draft) {
    const { data, error } = await createClient()
      .from("vehicle_extras")
      .insert({ ...draft, vehicle_id: vehicleId, position: nextPosition })
      .select("*")
      .single();
    if (error || !data) {
      toast.error("Couldn't add that. Try again.");
      return false;
    }
    setExtras((list) => [...list, data]);
    toast.success(`${data.name} added. Guests see it when they book.`);
    return true;
  }

  async function addPreset(p: Draft) {
    setBusy(p.name);
    await add(p);
    setBusy(null);
  }

  async function edit(id: string, draft: Draft) {
    const { data, error } = await createClient().from("vehicle_extras").update(draft).eq("id", id).select("*").single();
    if (error || !data) {
      toast.error("Couldn't save that. Try again.");
      return false;
    }
    setExtras((list) => list.map((e) => (e.id === id ? data : e)));
    toast.success("Saved. Trips already booked keep their extras.");
    return true;
  }

  async function setActive(extra: VehicleExtra, active: boolean) {
    setBusy(extra.id);
    setExtras((list) => list.map((e) => (e.id === extra.id ? { ...e, active } : e)));
    const { data, error } = await createClient().from("vehicle_extras").update({ active }).eq("id", extra.id).select("id");
    setBusy(null);
    if (error || !data?.length) {
      setExtras((list) => list.map((e) => (e.id === extra.id ? extra : e)));
      toast.error("Couldn't change that. Try again.");
      return;
    }
    toast.success(active ? `${extra.name} is on.` : `${extra.name} is off. Guests won't see it.`);
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = extras.findIndex((e) => e.id === id);
    const next = idx + dir;
    if (next < 0 || next >= extras.length) return;

    const before = extras;
    const reordered = [...extras];
    [reordered[idx], reordered[next]] = [reordered[next], reordered[idx]];
    const renumbered = reordered.map((e, i) => ({ ...e, position: i }));
    setExtras(renumbered);

    // Only write the rows whose position changed. Usually two.
    setBusy(id);
    const supabase = createClient();
    const changed = renumbered.filter((e) => before.find((b) => b.id === e.id)?.position !== e.position);
    const results = await Promise.all(
      changed.map((e) => supabase.from("vehicle_extras").update({ position: e.position }).eq("id", e.id).select("id"))
    );
    setBusy(null);
    if (results.some((r) => r.error || !r.data?.length)) {
      setExtras(before);
      toast.error("Couldn't save the order. Try again.");
    }
  }

  async function remove(extra: VehicleExtra) {
    setConfirmDelete(null);
    setBusy(extra.id);
    const { data, error } = await createClient().from("vehicle_extras").delete().eq("id", extra.id).select("id");
    setBusy(null);
    if (error || !data?.length) {
      toast.error("Couldn't delete that. Try again.");
      return;
    }
    setExtras((list) => list.filter((e) => e.id !== extra.id));
    toast.success(`${extra.name} deleted.`);
  }

  const current = editing && editing !== "new" ? extras.find((e) => e.id === editing) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[26px]">Extras · {extras.filter((e) => e.active).length}</h2>
        <Button variant="secondary" size="sm" onClick={() => setEditing("new")}>
          <Plus />
          Add an extra
        </Button>
      </div>
      <p className="text-[15px] text-slate">Guests can add these when they book. You&apos;re paid for them with the rental.</p>

      {extras.length === 0 && (
        <p className="rounded-[18px] bg-board p-3.5 text-[15px] text-slate">
          No extras yet. A child seat or prepaid fuel is an easy start.
        </p>
      )}

      {extras.map((e, i) => {
        const confirming = confirmDelete === e.id;
        return (
          <div
            key={e.id}
            className={cn("flex flex-wrap items-center gap-3 rounded-[18px] p-3.5", e.active ? "bg-board" : "bg-board/60")}
          >
            <div className="flex flex-col">
              <button
                type="button"
                aria-label={`Move ${e.name} up`}
                disabled={i === 0 || !!busy}
                onClick={() => move(e.id, -1)}
                className="rounded-[8px] p-1 hover:bg-line disabled:opacity-30"
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Move ${e.name} down`}
                disabled={i === extras.length - 1 || !!busy}
                onClick={() => move(e.id, 1)}
                className="rounded-[8px] p-1 hover:bg-line disabled:opacity-30"
              >
                <ChevronDown className="size-4" />
              </button>
            </div>

            <div className={cn("min-w-0 flex-[1_1_220px]", !e.active && "opacity-60")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-extrabold">{e.name}</span>
                <span className="figures text-[15px] font-bold">{extraPrice(e)}</span>
                {e.max_quantity > 1 && <Tag tone="white">Up to {e.max_quantity}</Tag>}
                {e.unlimited_miles && <Tag tone="sky">Unlimited miles</Tag>}
                {!e.active && <Tag tone="white">Off</Tag>}
              </div>
              {e.description && <p className="mt-0.5 text-sm text-slate">{e.description}</p>}
            </div>

            {confirming ? (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">Delete it?</span>
                <Button size="xs" variant="destructive" onClick={() => remove(e)}>
                  Delete
                </Button>
                <Button size="xs" variant="outline" onClick={() => setConfirmDelete(null)}>
                  Keep
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={e.active}
                  disabled={busy === e.id}
                  onChange={(next) => setActive(e, next)}
                  label={e.active ? "On" : "Off"}
                  className={cn("py-1.5", e.active ? "bg-mint" : "bg-white hover:bg-line")}
                />
                <Button size="icon-sm" variant="outline" aria-label={`Edit ${e.name}`} onClick={() => setEditing(e.id)}>
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label={`Delete ${e.name}`}
                  disabled={busy === e.id}
                  onClick={() => setConfirmDelete(e.id)}
                  className="text-error"
                >
                  <Trash2 />
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-sm font-semibold text-slate">Quick add</span>
          {presets.map((p) => (
            <button
              key={p.name}
              type="button"
              disabled={!!busy}
              onClick={() => addPreset(p)}
              className="flex items-center gap-1.5 rounded-[12px] bg-board px-3 py-2 text-sm font-bold transition-colors hover:bg-line disabled:opacity-60"
            >
              <Plus className="size-3.5" />
              {busy === p.name ? "Adding…" : p.name}
            </button>
          ))}
        </div>
      )}

      <ExtraDialog
        key={editing ?? "closed"}
        open={editing !== null}
        initial={current ?? BLANK}
        isNew={!current}
        onClose={() => setEditing(null)}
        onSave={(draft) => (current ? edit(current.id, draft) : add(draft))}
      />
    </div>
  );
}

function ExtraDialog({
  open,
  initial,
  isNew,
  onClose,
  onSave,
}: {
  open: boolean;
  initial: Draft;
  isNew: boolean;
  onClose: () => void;
  onSave: (draft: Draft) => Promise<boolean>;
}) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [price, setPrice] = useState(String(initial.price_cents / 100));
  const [per, setPer] = useState(initial.per);
  const [maxQuantity, setMaxQuantity] = useState(String(initial.max_quantity));
  const [unlimitedMiles, setUnlimitedMiles] = useState(initial.unlimited_miles);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const priceCents = Math.round(Number(price) * 100);
    const quantity = Math.round(Number(maxQuantity));
    if (name.trim().length < 2 || name.trim().length > 60) return toast.error("Give it a name of 2 to 60 letters.");
    if (description.trim().length > 300) return toast.error("Keep the description under 300 letters.");
    if (price.trim() === "" || !Number.isFinite(priceCents) || priceCents < 0 || priceCents > 100000) {
      return toast.error("Price has to be between 0 and 1000.");
    }
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 10) return toast.error("Most a guest can add is 1 to 10.");

    setSaving(true);
    const ok = await onSave({
      name: name.trim(),
      description: description.trim() || null,
      price_cents: priceCents,
      per,
      max_quantity: quantity,
      unlimited_miles: unlimitedMiles,
    });
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isNew ? "Add an extra" : initial.name}</DialogTitle>
          <DialogDescription className="text-[15px] text-slate">
            {isNew ? "Something guests can add to their trip." : "Trips already booked keep the price they were booked at."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="extra-name" className="text-sm font-semibold text-slate">
              Name
            </Label>
            <Input id="extra-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Child seat" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="extra-description" className="text-sm font-semibold text-slate">
              Short description
            </Label>
            <Textarea
              id="extra-description"
              value={description}
              maxLength={300}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What it is and anything guests should know."
              className="min-h-20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="extra-price" className="text-sm font-semibold text-slate">
              Price
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold">$</span>
              <Input
                id="extra-price"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="figures w-32 text-lg font-bold"
              />
              <div className="flex rounded-[14px] bg-board p-1" role="radiogroup" aria-label="Charged">
                {(["day", "trip"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={per === p}
                    onClick={() => setPer(p)}
                    className={cn(
                      "rounded-[10px] px-3.5 py-2 text-[15px] font-bold transition-colors",
                      per === p ? "bg-ink text-white" : "text-ink hover:bg-line"
                    )}
                  >
                    {p === "day" ? "a day" : "a trip"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="extra-quantity" className="text-sm font-semibold text-slate">
              Most a guest can add
            </Label>
            <Input
              id="extra-quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={10}
              value={maxQuantity}
              onChange={(e) => setMaxQuantity(e.target.value)}
              className="figures w-24 text-lg font-bold"
            />
          </div>
          <Switch
            checked={unlimitedMiles}
            onChange={setUnlimitedMiles}
            label="Includes unlimited miles"
            className="self-start"
          />
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isNew ? "Add" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
