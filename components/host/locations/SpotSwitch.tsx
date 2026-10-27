"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Switch } from "@/components/host/settings/Switch";

/** Offers one of the host's spots on this car, or stops offering it. */
export function SpotSwitch({
  locationId,
  vehicleId,
  name,
  on,
  allCars,
  otherCarIds,
}: {
  locationId: string;
  vehicleId: string;
  name: string;
  on: boolean;
  /** The spot is on every car, so turning it off here lists the others instead. */
  allCars: boolean;
  otherCarIds: string[];
}) {
  const router = useRouter();
  const [checked, setChecked] = useState(on);
  const [busy, setBusy] = useState(false);
  const [, startRefresh] = useTransition();

  async function change(next: boolean) {
    setChecked(next);
    setBusy(true);
    const supabase = createClient();
    const links = supabase.from("host_location_vehicles");
    let failed = false;
    if (next) {
      const { error } = await links.upsert({ location_id: locationId, vehicle_id: vehicleId }, { onConflict: "location_id,vehicle_id" });
      failed = !!error;
    } else if (allCars) {
      // From "all cars" to every car but this one.
      const rows = otherCarIds.map((vehicle_id) => ({ location_id: locationId, vehicle_id }));
      const added = rows.length ? await links.upsert(rows, { onConflict: "location_id,vehicle_id" }) : { error: null };
      const removed = await links.delete().eq("location_id", locationId).eq("vehicle_id", vehicleId);
      const updated = added.error
        ? added
        : await supabase.from("host_locations").update({ all_vehicles: false }).eq("id", locationId).select("id");
      failed = !!(added.error || removed.error || updated.error);
    } else {
      const { error } = await links.delete().eq("location_id", locationId).eq("vehicle_id", vehicleId);
      failed = !!error;
    }
    setBusy(false);
    if (failed) {
      setChecked(!next);
      toast.error("Couldn't change that. Try again.");
      return;
    }
    toast.success(next ? `${name} is offered on this car.` : `${name} is off for this car.`);
    startRefresh(() => router.refresh());
  }

  return (
    <Switch
      checked={checked}
      disabled={busy}
      onChange={change}
      label={<span className="sr-only">Offer {name} on this car</span>}
      className={checked ? "bg-white px-2 py-1.5" : "bg-white/60 px-2 py-1.5 hover:bg-white"}
    />
  );
}
