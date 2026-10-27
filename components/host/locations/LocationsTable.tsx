"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ellipsis, EyeOff, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ACCESS_LABEL, KIND_LABEL, feeLabel, type LocationWithCars } from "@/lib/locations";
import { cn, pluralize } from "@/lib/utils";
import { Tag } from "@/components/kit";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { KIND_ICON } from "./icons";
import { LocationDialog, type HostCar } from "./LocationDialog";

/** A home spot: the address one or more cars live at. */
export interface HomeRow {
  address: string;
  carIds: string[];
}

const COLUMNS = "lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.2fr)_minmax(0,1fr)_44px]";
const EMPTY = <span className="text-quiet">—</span>;

function Cell({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 text-[15px] lg:block", className)}>
      <span className="text-[12px] font-semibold text-slate lg:hidden">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function KindLabel({ kind, off }: { kind: LocationWithCars["kind"] | "home"; off?: boolean }) {
  const Icon = off ? EyeOff : KIND_ICON[kind];
  return (
    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-slate">
      <Icon className="size-3.5" strokeWidth={2} />
      {off ? "Off" : KIND_LABEL[kind]}
    </span>
  );
}

/** Turo-style fleet table: home spots, named delivery spots and the custom radius, with who each applies to. */
export function LocationsTable({
  hostId,
  locations,
  homes,
  cars,
}: {
  hostId: string;
  locations: LocationWithCars[];
  homes: HomeRow[];
  cars: HostCar[];
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // null: closed, "new" / "custom": adding, otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null);

  const custom = locations.find((l) => l.kind === "custom");
  const named = locations.filter((l) => l.kind !== "custom");
  const nextPosition = locations.reduce((max, l) => Math.max(max, l.position + 1), 0);
  const current = editing && editing !== "new" && editing !== "custom" ? locations.find((l) => l.id === editing) : undefined;

  const refresh = () => startRefresh(() => router.refresh());

  async function setEnabled(location: LocationWithCars, enabled: boolean) {
    setBusy(location.id);
    const { data, error } = await createClient()
      .from("host_locations")
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq("id", location.id)
      .select("id");
    setBusy(null);
    if (error || !data?.length) return toast.error("Couldn't change that. Try again.");
    toast.success(enabled ? `${location.name} is on.` : `${location.name} is off. Guests won't see it.`);
    refresh();
  }

  async function remove(location: LocationWithCars) {
    setConfirmDelete(null);
    setBusy(location.id);
    const { data, error } = await createClient().from("host_locations").delete().eq("id", location.id).select("id");
    setBusy(null);
    if (error || !data?.length) return toast.error("Couldn't delete that. Try again.");
    toast.success(`${location.kind === "custom" ? "Delivery radius" : location.name} deleted. Booked trips keep their spot.`);
    refresh();
  }

  const appliesTo = (l: LocationWithCars) =>
    l.all_vehicles ? `All cars (${cars.length})` : pluralize(l.host_location_vehicles.length, "car");

  function locationRow(l: LocationWithCars) {
    const off = !l.enabled;
    const varies = !l.all_vehicles && l.host_location_vehicles.some((x) => x.fee_cents != null && x.fee_cents !== l.fee_cents);
    const confirming = confirmDelete === l.id;
    return (
      <li
        key={l.id}
        className={cn(
          "grid grid-cols-2 items-center gap-x-4 gap-y-3 rounded-[18px] px-4 py-3.5 sm:grid-cols-3",
          COLUMNS,
          off ? "bg-board/60" : "bg-board"
        )}
      >
        <div className={cn("col-span-2 flex min-w-0 flex-col gap-0.5 sm:col-span-3 lg:col-span-1", off && "opacity-55")}>
          <KindLabel kind={l.kind} off={off} />
          <span className="text-[17px] leading-snug font-extrabold">
            {l.kind === "custom" ? `Within ${pluralize(l.radius_mi ?? 0, "mile")}` : l.name}
          </span>
          <span className="truncate text-[13px] text-slate">
            {l.kind === "custom" ? "of each car's home spot, to an address the guest picks" : (l.address ?? "No address yet")}
          </span>
        </div>
        <Cell label="Delivery fee" className={cn(off && "opacity-55")}>
          <span className="figures font-bold">{feeLabel(l)}</span>
          {varies && <span className="block text-[13px] text-slate">Some cars differ</span>}
        </Cell>
        <Cell label="Free delivery for" className={cn(off && "opacity-55")}>
          {l.free_from_days ? `${l.free_from_days}+ day trips` : EMPTY}
        </Cell>
        <Cell label="Vehicle access" className={cn(off && "opacity-55")}>
          {ACCESS_LABEL[l.vehicle_access]}
        </Cell>
        <Cell label="Applies to">
          <button
            type="button"
            onClick={() => setEditing(l.kind === "custom" ? "custom" : l.id)}
            className={cn("font-bold underline-offset-2 hover:underline", off ? "text-slate" : "text-cobalt")}
          >
            {appliesTo(l)}
          </button>
        </Cell>
        <div className="flex justify-end lg:justify-center">
          {confirming ? (
            <span className="flex items-center gap-1.5">
              <Button size="xs" variant="destructive" onClick={() => remove(l)}>
                Delete
              </Button>
              <Button size="xs" variant="outline" onClick={() => setConfirmDelete(null)}>
                Keep
              </Button>
            </span>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="outline" aria-label={`More for ${l.name}`} disabled={busy === l.id}>
                  <Ellipsis />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => setEditing(l.kind === "custom" ? "custom" : l.id)}>Edit</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setEnabled(l, off)}>{off ? "Turn on" : "Turn off"}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDelete(l.id)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3 transition-opacity", refreshing && "opacity-70")}>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!custom && (
          <Button variant="secondary" onClick={() => setEditing("custom")}>
            <Plus />
            Deliver to guests&apos; addresses
          </Button>
        )}
        <Button onClick={() => setEditing("new")}>
          <Plus />
          Add a location
        </Button>
      </div>

      <section className="rounded-[28px] bg-white p-3 sm:p-4">
        <div
          aria-hidden
          className={cn("hidden gap-x-4 px-4 pt-1 pb-3 text-[13px] font-semibold text-slate lg:grid", COLUMNS)}
        >
          <span>Location</span>
          <span>Delivery fee</span>
          <span>Free delivery for</span>
          <span>Vehicle access</span>
          <span>Applies to</span>
          <span className="text-center">Update</span>
        </div>
        <ul className="flex flex-col gap-2">
          {homes.map((h) => (
            <li
              key={h.address}
              className={cn("grid grid-cols-2 items-center gap-x-4 gap-y-3 rounded-[18px] bg-board px-4 py-3.5 sm:grid-cols-3", COLUMNS)}
            >
              <div className="col-span-2 flex min-w-0 flex-col gap-0.5 sm:col-span-3 lg:col-span-1">
                <KindLabel kind="home" />
                <span className="text-[17px] leading-snug font-extrabold">{h.address}</span>
                <span className="text-[13px] text-slate">Pick-up and return here is free</span>
              </div>
              <Cell label="Delivery fee">{EMPTY}</Cell>
              <Cell label="Free delivery for">{EMPTY}</Cell>
              <Cell label="Vehicle access">{EMPTY}</Cell>
              <Cell label="Applies to">
                <span className="font-bold">{pluralize(h.carIds.length, "car")}</span>
              </Cell>
              <div className="flex justify-end lg:justify-center">
                <Button asChild size="icon-sm" variant="outline" aria-label="Edit home spot">
                  <Link href={`/host/hours?car=${h.carIds[0]}`}>
                    <Pencil />
                  </Link>
                </Button>
              </div>
            </li>
          ))}
          {named.map(locationRow)}
          {custom && locationRow(custom)}
        </ul>
        {named.length === 0 && !custom && (
          <p className="mt-2 rounded-[18px] bg-board p-4 text-[15px] text-slate">
            Only home spots so far. Add the airport or a hotel nearby so guests can get the car where they land.
          </p>
        )}
      </section>

      <div className="flex flex-wrap gap-2 text-sm text-slate">
        <Tag tone="sky">Good to know</Tag>
        <span className="flex-[1_1_300px]">
          Delivery fees cover the drop-off and the pick-up, and you get 80% of them, like the rental. Guests see a
          spot&apos;s address and handover note only once their trip is booked.
        </span>
      </div>

      <LocationDialog
        key={editing ?? "closed"}
        open={editing !== null}
        hostId={hostId}
        location={editing === "custom" ? (custom ?? null) : (current ?? null)}
        custom={editing === "custom"}
        cars={cars}
        nextPosition={nextPosition}
        onClose={() => setEditing(null)}
        onSaved={refresh}
      />
    </div>
  );
}
