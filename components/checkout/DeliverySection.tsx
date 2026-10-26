"use client";

import { useEffect, useState } from "react";
import { MapPin, Search } from "lucide-react";
import type { GeocodeSuggestion } from "@/app/api/geocode/route";
import type { DeliverySettings } from "@/lib/pricing";
import { formatCurrency, formatPrice } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Choice, Notice, Section } from "./parts";
import type { DeliveryResult } from "./rules";

export type DeliveryMode = "pickup" | "address" | "airport";
export interface Place {
  address: string;
  lat: number;
  lng: number;
}

/** Pick up at the host's spot, or have the car brought to an address or the airport. */
export function DeliverySection({
  car,
  mode,
  place,
  quote,
  onMode,
  onPlace,
}: {
  car: DeliverySettings & { location_name: string };
  mode: DeliveryMode;
  place: Place | null;
  /** The price for the current choice, or why it can't be done. Null until an address is picked. */
  quote: DeliveryResult | null;
  onMode: (mode: DeliveryMode) => void;
  onPlace: (place: Place | null) => void;
}) {
  const [query, setQuery] = useState(place?.address ?? "");
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);

  // Look the address up as they type, a moment after they stop.
  useEffect(() => {
    if (mode !== "address" || query.trim().length < 3 || query === place?.address) return;
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
  }, [mode, query, place?.address]);

  const deliveryFrom =
    car.delivery_fee_per_mi_cents > 0
      ? `${formatPrice(car.delivery_fee_cents)} + ${formatPrice(car.delivery_fee_per_mi_cents)}/mi`
      : formatPrice(car.delivery_fee_cents);

  return (
    <Section icon={<MapPin />} iconTone="bg-mint" title="Getting the car">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-2">
        <Choice on={mode === "pickup"} onClick={() => onMode("pickup")}>
          <span className="flex w-full items-center justify-between gap-2">
            <span className="text-[17px] font-extrabold">Pick it up</span>
            <span className="figures text-[15px] font-bold">$0</span>
          </span>
          <span className="text-sm opacity-75">At the host&apos;s spot in {car.location_name}.</span>
        </Choice>
        {car.delivery_enabled && (
          <Choice on={mode === "address"} onClick={() => onMode("address")}>
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-[17px] font-extrabold">Deliver it</span>
              <span className="figures text-[15px] font-bold">{deliveryFrom}</span>
            </span>
            <span className="text-sm opacity-75">To an address up to {car.delivery_radius_mi} mi away.</span>
          </Choice>
        )}
        {car.airport_delivery_fee_cents != null && (
          <Choice on={mode === "airport"} onClick={() => onMode("airport")}>
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-[17px] font-extrabold">Airport</span>
              <span className="figures text-[15px] font-bold">{formatPrice(car.airport_delivery_fee_cents)}</span>
            </span>
            <span className="text-sm opacity-75">Meet at Sea-Tac arrivals.</span>
          </Choice>
        )}
      </div>

      {mode === "address" && (
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
            <p className="figures text-sm text-slate">Delivery to this address is {formatCurrency(quote.cents)}.</p>
          )}
        </div>
      )}
      {mode === "airport" && quote && !quote.ok && <Notice>{quote.reason}</Notice>}
    </Section>
  );
}
