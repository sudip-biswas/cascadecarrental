"use client";

import { useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import type { MapPin } from "./map";

const LeafletMap = dynamic(() => import("./LeafletMap"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-line" />,
});

/**
 * Price pins for the results. Tapping one shows that car's card over the map.
 * The cards come rendered from the server, keyed by car id.
 */
export function SearchMap({ pins, cards, className }: { pins: MapPin[]; cards: Record<string, ReactNode>; className?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const card = selected ? cards[selected] : null;

  return (
    <div className={className}>
      <div className="relative isolate size-full overflow-hidden bg-line sm:rounded-[26px]">
        <LeafletMap pins={pins} selected={selected} onSelect={setSelected} />
        {card && (
          <div className="absolute inset-x-3 bottom-3 z-[1000] sm:right-auto sm:w-[380px]">
            {card}
            <button
              type="button"
              aria-label="Close"
              onClick={() => setSelected(null)}
              className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full bg-ink text-white hover:bg-graphite"
            >
              <X className="size-4" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
