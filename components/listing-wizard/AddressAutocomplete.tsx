"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GeocodeSuggestion } from "@/app/api/geocode/route";

interface Props {
  /** Current free-text value shown in the input. */
  value: string;
  error?: string;
  onSelect: (suggestion: GeocodeSuggestion) => void;
  onClear: () => void;
  onChange: (raw: string) => void;
}

export function AddressAutocomplete({ value, error, onSelect, onClear, onChange }: Props) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep query in sync when value changes externally (e.g. clear)
  useEffect(() => { setQuery(value); }, [value]);

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { suggestions: GeocodeSuggestion[] };
      setSuggestions(data.suggestions ?? []);
      setOpen((data.suggestions?.length ?? 0) > 0);
      setActiveIdx(-1);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(raw: string) {
    setQuery(raw);
    onChange(raw);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(raw), 350);
  }

  function pick(s: GeocodeSuggestion) {
    setQuery(s.label);
    setSuggestions([]);
    setOpen(false);
    onSelect(s);
  }

  function clear() {
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    onClear();
  }

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      pick(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <label
        className={cn(
          "flex min-w-0 flex-col gap-0.5 rounded-2xl px-3.5 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-ink",
          error ? "bg-error-soft" : "bg-board"
        )}
      >
        <span className="text-[13px] font-semibold text-slate">Pickup location</span>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
            autoComplete="off"
            spellCheck={false}
            placeholder="Search address or area…"
            className="w-full min-w-0 bg-transparent p-0 text-[17px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-quiet"
          />
          {loading && (
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate border-t-transparent" />
          )}
          {!loading && query && (
            <button type="button" onClick={clear} className="shrink-0 text-quiet hover:text-ink">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </label>
      {error && <p className="px-1 text-[13px] font-semibold text-error">{error}</p>}

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute top-full z-50 mt-1.5 w-full overflow-hidden rounded-2xl border border-line bg-white shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li
              key={`${s.lat},${s.lng}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 px-4 py-3 text-sm transition-colors",
                i === activeIdx ? "bg-board" : "hover:bg-board"
              )}
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate" />
              <span className="min-w-0">
                <span className="block font-semibold text-ink leading-snug">{s.shortName}</span>
                <span className="block text-slate text-xs leading-snug line-clamp-1">{s.label}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
