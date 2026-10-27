"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { GeocodeSuggestion } from "@/app/api/geocode/route";
import { createClient } from "@/lib/supabase/client";
import { ACCESS_LABEL, KIND_LABEL, SPOT_KINDS, type LocationWithCars } from "@/lib/locations";
import type { HostLocationKind, VehicleAccess } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/host/settings/Switch";
import { CarPhoto } from "@/components/host/bits";

export interface HostCar {
  id: string;
  make: string;
  model: string;
  cover: string | null;
}

const ACCESS: VehicleAccess[] = ["lockbox", "in_person", "remote_unlock"];
export const CUSTOM_NAME = "Delivery to your address";

/** A row of buttons that work like radio buttons. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-[14px] bg-board p-1" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-[10px] px-3 py-2 text-[15px] font-bold transition-colors",
            value === o.value ? "bg-ink text-white" : "text-ink hover:bg-line"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Field({ id, label, children, hint }: { id?: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-semibold text-slate">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[13px] text-slate">{hint}</p>}
    </div>
  );
}

const dollars = (cents: number) => String(cents / 100);

/** Add or edit a named spot, or the custom delivery radius. */
export function LocationDialog({
  open,
  hostId,
  location,
  custom,
  cars,
  nextPosition,
  onClose,
  onSaved,
}: {
  open: boolean;
  hostId: string;
  /** The location being edited, or null to add one. */
  location: LocationWithCars | null;
  /** Adding or editing the custom radius rather than a named spot. */
  custom: boolean;
  cars: HostCar[];
  nextPosition: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<Exclude<HostLocationKind, "custom">>(
    location && location.kind !== "custom" ? location.kind : "hotel"
  );
  const [name, setName] = useState(location?.kind === "custom" ? "" : (location?.name ?? ""));
  const [address, setAddress] = useState(location?.address ?? "");
  const [point, setPoint] = useState(location?.lat != null && location.lng != null ? { lat: location.lat, lng: location.lng } : null);
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [fee, setFee] = useState(dollars(location?.fee_cents ?? (custom ? 4000 : 0)));
  const [perMile, setPerMile] = useState(dollars(location?.fee_per_mi_cents ?? 0));
  const [radius, setRadius] = useState(String(location?.radius_mi ?? 3));
  const [freeOn, setFreeOn] = useState(location?.free_from_days != null);
  const [freeDays, setFreeDays] = useState(String(location?.free_from_days ?? 6));
  const [access, setAccess] = useState<VehicleAccess>(location?.vehicle_access ?? "lockbox");
  const [note, setNote] = useState(location?.handover_note ?? "");
  const [allCars, setAllCars] = useState(location?.all_vehicles ?? true);
  const [chosen, setChosen] = useState<Set<string>>(
    () => new Set(location?.host_location_vehicles.map((l) => l.vehicle_id) ?? [])
  );
  const [saving, setSaving] = useState(false);

  // Look the address up as they type, so the spot can go on a map.
  useEffect(() => {
    if (custom || address.trim().length < 4 || point) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(address.trim())}`, { signal: controller.signal }).catch(
        () => null
      );
      const data = res?.ok ? await res.json().catch(() => null) : null;
      setSuggestions(data?.suggestions ?? []);
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [custom, address, point]);

  function toggleCar(id: string) {
    setChosen((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const feeCents = Math.round(Number(fee) * 100);
    const perMileCents = Math.round(Number(perMile || 0) * 100);
    const radiusMi = Math.round(Number(radius));
    const days = Math.round(Number(freeDays));
    if (!custom && (name.trim().length < 2 || name.trim().length > 80)) return toast.error("Give it a name of 2 to 80 letters.");
    if (fee.trim() === "" || !Number.isFinite(feeCents) || feeCents < 0 || feeCents > 50000) {
      return toast.error("The fee has to be between 0 and 500.");
    }
    if (custom && (!Number.isFinite(perMileCents) || perMileCents < 0 || perMileCents > 1000)) {
      return toast.error("The fee per mile has to be between 0 and 10.");
    }
    if (custom && (!Number.isFinite(radiusMi) || radiusMi < 1 || radiusMi > 100)) {
      return toast.error("The radius has to be between 1 and 100 miles.");
    }
    if (freeOn && (!Number.isFinite(days) || days < 1 || days > 90)) return toast.error("Free delivery needs a trip length of 1 to 90 days.");
    if (!allCars && chosen.size === 0) return toast.error("Pick at least one car, or choose all cars.");

    setSaving(true);
    const supabase = createClient();
    const row = {
      kind: custom ? ("custom" as const) : kind,
      name: custom ? CUSTOM_NAME : name.trim(),
      address: custom ? null : address.trim() || null,
      lat: custom ? null : (point?.lat ?? null),
      lng: custom ? null : (point?.lng ?? null),
      fee_cents: feeCents,
      fee_per_mi_cents: custom ? perMileCents : 0,
      radius_mi: custom ? radiusMi : null,
      free_from_days: freeOn ? days : null,
      vehicle_access: access,
      handover_note: note.trim() || null,
      all_vehicles: allCars,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = location
      ? await supabase.from("host_locations").update(row).eq("id", location.id).select("id").single()
      : await supabase
          .from("host_locations")
          .insert({ ...row, host_id: hostId, position: nextPosition })
          .select("id")
          .single();
    if (error || !data) {
      setSaving(false);
      toast.error(error?.code === "23505" ? "You already have a delivery radius. Edit that one." : "Couldn't save that. Try again.");
      return;
    }

    // Which cars it's on. A new fee replaces any per-car price.
    const had = new Set(location?.host_location_vehicles.map((l) => l.vehicle_id) ?? []);
    const links = supabase.from("host_location_vehicles");
    const results = await Promise.all([
      allCars
        ? had.size > 0
          ? links.delete().eq("location_id", data.id)
          : null
        : Promise.all([
            [...had].some((id) => !chosen.has(id))
              ? links.delete().eq("location_id", data.id).in("vehicle_id", [...had].filter((id) => !chosen.has(id)))
              : null,
            [...chosen].some((id) => !had.has(id))
              ? links.insert([...chosen].filter((id) => !had.has(id)).map((vehicle_id) => ({ location_id: data.id, vehicle_id })))
              : null,
          ]),
      location && location.fee_cents !== feeCents && !allCars
        ? links.update({ fee_cents: null }).eq("location_id", data.id)
        : null,
    ]);
    setSaving(false);
    if (results.flat().some((r) => r && "error" in r && r.error)) {
      toast.error("Saved, but the cars it applies to didn't update. Try again.");
    } else {
      toast.success(location ? "Saved. Trips already booked keep their spot and price." : "Added. Guests can pick it when they book.");
    }
    onSaved();
    onClose();
  }

  const title = custom ? "Delivery to the guest's address" : location ? location.name : "Add a location";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-[15px] text-slate">
            {custom
              ? "Bring the car to an address the guest picks, within a set distance of the car."
              : "A spot where guests can get the car, like the airport or a hotel nearby."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="flex flex-col gap-4">
          {!custom && (
            <>
              <Field label="Kind of place">
                <Segmented
                  label="Kind of place"
                  value={kind}
                  options={SPOT_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
                  onChange={setKind}
                />
              </Field>
              <Field id="location-name" label="Name guests see">
                <Input
                  id="location-name"
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="DoubleTree SeaTac"
                />
              </Field>
              <div className="relative flex flex-col gap-1.5">
                <Field id="location-address" label="Address" hint="Guests only see it once their trip is booked.">
                  <Input
                    id="location-address"
                    value={address}
                    maxLength={200}
                    autoComplete="off"
                    onChange={(e) => {
                      setAddress(e.target.value);
                      setPoint(null);
                    }}
                    placeholder="18740 International Blvd, SeaTac, WA 98188"
                  />
                </Field>
                {suggestions.length > 0 && !point && (
                  <ul className="flex flex-col gap-1 rounded-[16px] bg-board p-1.5">
                    {suggestions.slice(0, 4).map((s) => (
                      <li key={`${s.lat},${s.lng}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setAddress(s.label);
                            setPoint({ lat: s.lat, lng: s.lng });
                            setSuggestions([]);
                          }}
                          className="w-full rounded-[12px] px-3 py-2 text-left text-sm hover:bg-white"
                        >
                          {s.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          {custom && (
            <Field id="location-radius" label="How far you'll go from the car">
              <div className="flex items-center gap-2">
                <Input
                  id="location-radius"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="figures w-24 text-lg font-bold"
                />
                <span className="text-[15px] font-bold">miles</span>
              </div>
            </Field>
          )}

          <Field id="location-fee" label="Delivery fee" hint="Covers the drop-off and the pick-up. Set 0 for free.">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold">$</span>
              <Input
                id="location-fee"
                type="number"
                inputMode="decimal"
                step="1"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className="figures w-28 text-lg font-bold"
              />
              {custom && (
                <>
                  <span className="text-[15px] font-bold">plus</span>
                  <Input
                    aria-label="Fee per mile"
                    type="number"
                    inputMode="decimal"
                    step="0.25"
                    value={perMile}
                    onChange={(e) => setPerMile(e.target.value)}
                    className="figures w-24 text-lg font-bold"
                  />
                  <span className="text-[15px] font-bold">a mile</span>
                </>
              )}
            </div>
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Switch checked={freeOn} onChange={setFreeOn} label="Free for longer trips" />
            {freeOn && (
              <span className="flex items-center gap-2 text-[15px] font-bold">
                <Input
                  aria-label="Free for trips of this many days or more"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={90}
                  value={freeDays}
                  onChange={(e) => setFreeDays(e.target.value)}
                  className="figures w-20 text-lg font-bold"
                />
                + day trips
              </span>
            )}
          </div>

          <Field label="How guests get the key">
            <Segmented
              label="How guests get the key"
              value={access}
              options={ACCESS.map((a) => ({ value: a, label: ACCESS_LABEL[a] }))}
              onChange={setAccess}
            />
          </Field>

          <Field id="location-note" label="Handover note" hint="Shown to the guest only after they book.">
            <Textarea
              id="location-note"
              value={note}
              maxLength={1000}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                access === "lockbox"
                  ? "Lockbox is on the rail by the hotel's front entrance. Code comes in your trip messages."
                  : "Text me when you land and I'll meet you at the curb."
              }
              className="min-h-20"
            />
          </Field>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate">Cars it applies to</span>
            <Segmented
              label="Cars it applies to"
              value={allCars ? "all" : "some"}
              options={[
                { value: "all", label: `All cars (${cars.length})` },
                { value: "some", label: "Chosen cars" },
              ]}
              onChange={(v) => setAllCars(v === "all")}
            />
            {!allCars && (
              <div className="flex flex-wrap gap-2">
                {cars.map((c) => {
                  const on = chosen.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleCar(c.id)}
                      className={cn(
                        "flex h-[42px] items-center gap-2 rounded-[12px] px-2 pr-3 text-sm font-bold transition-colors",
                        on ? "bg-ink text-white" : "bg-board hover:bg-line"
                      )}
                    >
                      <CarPhoto src={c.cover} alt="" sizes="30px" className="h-6 w-[30px] rounded-[6px]" />
                      {c.make} {c.model}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : location ? "Save" : "Add"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
