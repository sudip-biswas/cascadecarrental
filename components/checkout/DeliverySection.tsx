"use client";

import { useEffect, useState } from "react";
import { MapPin, Search } from "lucide-react";
import type { GeocodeSuggestion } from "@/app/api/geocode/route";
import { ACCESS_LABEL, feeLabel, freeRule, isFreeFor, type PickupOption, type PickupQuote } from "@/lib/locations";
import { cn, formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Choice, Notice, Section } from "./parts";

export interface Place {
  address: string;
  lat: number;
  lng: number;
}

/** The line under a spot's name: how the handover works and when it's free. */
function spotNote(option: PickupOption): string {
  if (option.kind === "car") return `At the host's spot in ${option.name}.`;
  if (option.kind === "custom") {
    return [`To an address up to ${option.radius_mi} mi away.`, freeRule(option)].filter(Boolean).join(" ");
  }
  return [option.vehicle_access ? `${ACCESS_LABEL[option.vehicle_access]}.` : null, freeRule(option)].filter(Boolean).join(" ");
}

/** The fee for this trip, crossed out when the trip is long enough to be free. */
export function SpotPrice({ option, days }: { option: PickupOption; days: number }) {
  const label = feeLabel(option);
  if (label !== "Free" && isFreeFor(option, days)) {
    return (
      <span className="figures text-[15px] font-bold">
        <s className="mr-1.5 font-medium opacity-60">{label}</s>Free
      </span>
    );
  }
  return <span className="figures text-[15px] font-bold">{label}</span>;
}

/** The car page's pickup choice: shows the current spot, opens to the list. */
export function PickupPicker({
  options,
  days,
  spot,
  onSpot,
}: {
  options: PickupOption[];
  days: number;
  spot: string;
  onSpot: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const picked = options.find((o) => o.id === spot) ?? options[0];
  const title = (o: PickupOption) => (o.kind === "car" ? o.name : o.kind === "custom" ? "Delivered to your address" : o.name);

  return (
    <div className="flex flex-col gap-2 rounded-[18px] bg-board p-3.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-mint">
          <MapPin className="size-[18px]" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-slate">Pickup and return</span>
          <span className="block truncate text-base font-bold">{title(picked)}</span>
        </span>
        <span className="text-sm font-bold underline underline-offset-2">{open ? "Done" : "Change"}</span>
      </button>
      {open && (
        <div role="radiogroup" aria-label="Pickup and return" className="flex flex-col gap-1">
          {options.map((o) => {
            const on = o.id === spot;
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  onSpot(o.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-[14px] px-3 py-2.5 text-left transition-colors",
                  on ? "bg-ink text-white" : "bg-white hover:bg-line"
                )}
              >
                <span className="min-w-0">
                  <span className="block text-[15px] font-bold">{title(o)}</span>
                  <span className={cn("block text-[13px]", on ? "text-[#c9ccd3]" : "text-slate")}>
                    {o.kind === "car" ? "Pick up at the car's spot." : spotNote(o)}
                  </span>
                </span>
                <SpotPrice option={o} days={days} />
              </button>
            );
          })}
        </div>
      )}
      <p className="text-[13px] text-slate">We&apos;ll send you the exact address once your trip is booked.</p>
    </div>
  );
}

/** Pick up at the car's spot, at one of the host's named spots, or have it brought to an address. */
export function DeliverySection({
  options,
  days,
  spot,
  place,
  quote,
  onSpot,
  onPlace,
}: {
  options: PickupOption[];
  days: number;
  spot: string;
  place: Place | null;
  /** The price for the current choice, or why it can't be done. Null until an address is picked. */
  quote: PickupQuote | null;
  onSpot: (id: string) => void;
  onPlace: (place: Place | null) => void;
}) {
  const [query, setQuery] = useState(place?.address ?? "");
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const picked = options.find((o) => o.id === spot);
  const custom = picked?.kind === "custom";

  // Look the address up as they type, a moment after they stop.
  useEffect(() => {
    if (!custom || query.trim().length < 3 || query === place?.address) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal }).catch(
        () => null
      );
      const data = res?.ok ? await res.json().catch(() => null) : null;
      setSuggestions(data?.suggestions ?? []);
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [custom, query, place?.address]);

  return (
    <Section icon={<MapPin />} iconTone="bg-mint" title="Pickup and return">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-2">
        {options.map((o) => (
          <Choice key={o.id} on={spot === o.id} onClick={() => onSpot(o.id)}>
            <span className="flex w-full items-start justify-between gap-2">
              <span className="text-[17px] leading-tight font-extrabold">
                {o.kind === "car" ? "Pick it up" : o.kind === "custom" ? "Deliver to me" : o.name}
              </span>
              <SpotPrice option={o} days={days} />
            </span>
            <span className="text-sm opacity-75">{spotNote(o)}</span>
          </Choice>
        ))}
      </div>

      {custom && (
        <div className="relative flex flex-col gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-slate">Delivery address</span>
            <span className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-quiet" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (place) onPlace(null);
                }}
                placeholder="Street address, hotel, neighborhood…"
                autoComplete="street-address"
                className="pl-11"
              />
            </span>
          </label>
          {suggestions.length > 0 && !place && (
            <ul className="flex flex-col gap-1 rounded-[16px] bg-board p-1.5">
              {suggestions.map((s) => (
                <li key={`${s.lat},${s.lng}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(s.label);
                      setSuggestions([]);
                      onPlace({ address: s.label, lat: s.lat, lng: s.lng });
                    }}
                    className="w-full rounded-[12px] px-3 py-2.5 text-left text-[15px] hover:bg-white"
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {quote && !quote.ok && <Notice>{quote.reason}</Notice>}
          {quote?.ok && (
            <p className="figures text-sm text-slate">
              {quote.cents === 0 ? "Delivery to this address is free." : `Delivery to this address is ${formatCurrency(quote.cents)}.`}
            </p>
          )}
        </div>
      )}
      {!custom && quote && !quote.ok && <Notice>{quote.reason}</Notice>}
      <p className="text-sm text-slate">
        {custom
          ? "The host brings the car to you and picks it up from the same address."
          : "We'll send you the exact address and how to get the keys once your trip is booked."}
      </p>
    </Section>
  );
}
