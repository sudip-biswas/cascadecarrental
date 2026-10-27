"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tile, TileTitle } from "@/components/kit";
import { createClient } from "@/lib/supabase/client";
import type { Database, Vehicle } from "@/lib/supabase/types";
import {
  BoxInput,
  FieldBox,
  NoticeSelect,
  RuleRow,
  Stepper,
  Toggle,
  formatDays,
} from "@/components/listing-wizard/controls";
import { LIMITS } from "@/lib/listing-limits";
import { BUFFER_OPTIONS, formatBuffer } from "@/lib/trip-rules";

/** Hours kept free between one trip's return and the next pickup. */
function BufferSelect({ value, onChange, disabled }: { value: number; onChange: (hours: number) => void; disabled?: boolean }) {
  const options = BUFFER_OPTIONS.includes(value) ? BUFFER_OPTIONS : [...BUFFER_OPTIONS, value].sort((a, b) => a - b);
  return (
    <select
      aria-label="Time between trips"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-[38px] cursor-pointer rounded-[10px] bg-board px-3 text-[15px] font-bold outline-none hover:bg-line focus-visible:ring-2 focus-visible:ring-ink"
    >
      {options.map((h) => (
        <option key={h} value={h}>
          {formatBuffer(h)}
        </option>
      ))}
    </select>
  );
}

type Rules = Pick<
  Vehicle,
  | "location_name"
  | "location_address"
  | "min_trip_days"
  | "max_trip_days"
  | "advance_notice_hours"
  | "trip_buffer_hours"
  | "weekend_min_two_days"
  | "instant_book"
>;
type VehicleUpdate = Database["public"]["Tables"]["vehicles"]["Update"];

export function RulesEditor({ vehicleId, initial, locked }: { vehicleId: string; initial: Rules; locked: boolean }) {
  const router = useRouter();
  const [rules, setRules] = useState(initial);
  const [area, setArea] = useState(initial.location_name);
  const [address, setAddress] = useState(initial.location_address ?? "");
  const [savingPlace, setSavingPlace] = useState(false);

  async function save(update: VehicleUpdate): Promise<boolean> {
    const { data, error } = await createClient()
      .from("vehicles")
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("id", vehicleId)
      .select("id");
    // RLS turns a blocked update into zero rows rather than an error.
    if (error || !data?.length) {
      toast.error("Not saved. Try again.");
      return false;
    }
    router.refresh();
    return true;
  }

  /** Steppers and toggles save on change: show it now, put it back if saving fails. */
  async function change(update: Partial<Rules>) {
    const before = rules;
    setRules({ ...rules, ...update });
    if (!(await save(update))) setRules(before);
  }

  async function savePlace() {
    const name = area.trim();
    if (!name) {
      toast.error("Say where guests pick up.");
      return;
    }
    setSavingPlace(true);
    const ok = await save({ location_name: name, location_address: address.trim() || null });
    setSavingPlace(false);
    if (ok) {
      setRules({ ...rules, location_name: name, location_address: address.trim() || null });
      toast.success("Pickup spot saved.");
    }
  }

  const placeChanged = area.trim() !== rules.location_name || address.trim() !== (rules.location_address ?? "");

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,330px),1fr))] gap-4">
      <Tile className="flex flex-col gap-2.5 sm:p-6">
        <TileTitle className="mb-1">Where guests meet you</TileTitle>
        <FieldBox label="Area guests see, like a neighbourhood or the airport">
          <BoxInput value={area} maxLength={80} disabled={locked} onChange={(e) => setArea(e.target.value)} />
        </FieldBox>
        <FieldBox label="Exact address">
          <BoxInput
            value={address}
            maxLength={200}
            disabled={locked}
            autoComplete="street-address"
            placeholder="Street, city, ZIP"
            onChange={(e) => setAddress(e.target.value)}
          />
        </FieldBox>
        <p className="px-1 text-sm text-slate">The address isn&apos;t shown on your listing. Guests only see the area.</p>
        {placeChanged && (
          <Button className="self-start" onClick={savePlace} disabled={savingPlace || locked}>
            {savingPlace ? "Saving…" : "Save pickup spot"}
          </Button>
        )}
      </Tile>

      <Tile tone="sky" className="flex flex-col gap-3 text-ink sm:p-6">
        <TileTitle className="mb-1">Trip rules</TileTitle>
        <RuleRow label="Shortest trip">
          <Stepper
            label="shortest trip"
            value={rules.min_trip_days}
            min={1}
            max={Math.min(LIMITS.minTripMax, rules.max_trip_days)}
            format={formatDays}
            disabled={locked}
            onChange={(min_trip_days) => change({ min_trip_days })}
          />
        </RuleRow>
        <RuleRow label="Longest trip">
          <Stepper
            label="longest trip"
            value={rules.max_trip_days}
            min={rules.min_trip_days}
            max={LIMITS.maxTripMax}
            format={formatDays}
            disabled={locked}
            onChange={(max_trip_days) => change({ max_trip_days })}
          />
        </RuleRow>
        <RuleRow label="Notice before pickup">
          <NoticeSelect
            value={rules.advance_notice_hours}
            disabled={locked}
            onChange={(advance_notice_hours) => change({ advance_notice_hours })}
          />
        </RuleRow>
        <RuleRow label="Time between trips">
          <BufferSelect
            value={rules.trip_buffer_hours}
            disabled={locked}
            onChange={(trip_buffer_hours) => change({ trip_buffer_hours })}
          />
        </RuleRow>
        <Toggle
          label="2-day minimum on weekends"
          hint="Trips starting Friday, Saturday or Sunday last at least 2 days"
          checked={rules.weekend_min_two_days}
          disabled={locked}
          onChange={(weekend_min_two_days) => change({ weekend_min_two_days })}
        />
        <Toggle
          label="Instant book"
          hint={rules.instant_book ? "On: guests book and pay straight away" : "Off: you approve each request"}
          checked={rules.instant_book}
          disabled={locked}
          onChange={(instant_book) => change({ instant_book })}
        />
        <p className="px-1 text-sm text-sky-ink">Changes apply to new bookings. Trips already booked stay as they are.</p>
      </Tile>
    </div>
  );
}
