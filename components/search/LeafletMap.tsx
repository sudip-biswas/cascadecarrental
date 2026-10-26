"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MapPin } from "./map";

const SEATTLE: L.LatLngTuple = [47.6062, -122.3321];

function priceIcon(label: string, active: boolean) {
  const tone = active ? "bg-cobalt text-white" : "bg-ink text-white hover:bg-graphite";
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<span class="figures absolute -translate-x-1/2 -translate-y-full cursor-pointer rounded-full px-2.5 py-1.5 text-[14px] leading-none font-extrabold whitespace-nowrap transition-colors ${tone}">${label}</span>`,
  });
}

/**
 * The map itself. Leaflet needs the browser, so SearchMap loads this file on
 * the client only.
 */
export default function LeafletMap({
  pins,
  selected,
  onSelect,
}: {
  pins: MapPin[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, { marker: L.Marker; pin: MapPin }>());
  const select = useRef(onSelect);

  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const m = L.map(el.current!, { scrollWheelZoom: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    m.on("click", () => select.current(null));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const layer = L.layerGroup().addTo(m);
    const placed = markers.current;
    placed.clear();
    for (const pin of pins) {
      const marker = L.marker([pin.lat, pin.lng], { icon: priceIcon(pin.label, false), title: pin.title, riseOnHover: true })
        .on("click", () => select.current(pin.id))
        .addTo(layer);
      placed.set(pin.id, { marker, pin });
    }
    if (pins.length) {
      m.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lng])), { padding: [48, 48], maxZoom: 14 });
    } else {
      m.setView(SEATTLE, 11);
    }
    return () => {
      layer.remove();
    };
  }, [pins]);

  useEffect(() => {
    for (const [id, { marker, pin }] of markers.current) {
      const active = id === selected;
      marker.setIcon(priceIcon(pin.label, active));
      marker.setZIndexOffset(active ? 1000 : 0);
    }
  }, [selected, pins]);

  return <div ref={el} className="size-full" />;
}
