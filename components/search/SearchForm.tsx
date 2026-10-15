"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { TripDatesPicker } from "./TripDatesPicker";
import type { DateKey } from "./dates";
import type { GeocodeSuggestion } from "@/app/api/geocode/route";

interface Props {
  where?: string;
  from?: DateKey;
  until?: DateKey;
  /** Filters to keep when searching again from the results page. */
  keep?: Record<string, string>;
  size?: "lg" | "md";
  className?: string;
}

/** Where and when. Sends people to /search with both in the URL. */
export function SearchForm({ where = "", from, until, keep, size = "lg", className }: Props) {
  const router = useRouter();
  const [place, setPlace] = useState(where);
  const [dates, setDates] = useState<{ from?: DateKey; until?: DateKey }>({ from, until });
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
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
    setPlace(raw);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(raw), 300);
  }

  function buildParams(placeName: string) {
    const params = new URLSearchParams(keep);
    const trimmed = placeName.trim();
    if (trimmed) params.set("where", trimmed);
    else params.delete("where");
    if (dates.from && dates.until) {
      params.set("from", dates.from);
      params.set("until", dates.until);
    } else {
      params.delete("from");
      params.delete("until");
    }
    return params;
  }

  function pick(s: GeocodeSuggestion) {
    setPlace(s.shortName);
    setSuggestions([]);
    setOpen(false);
    const params = buildParams(s.shortName);
    router.push(`/search?${params.toString()}`);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setOpen(false);
    const params = buildParams(place);
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
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
    <form
      onSubmit={submit}
      role="search"
      className={cn(
        "flex flex-col gap-2 rounded-[24px] bg-white sm:flex-row sm:flex-wrap",
        size === "lg" ? "p-2.5" : "p-2",
        className
      )}
    >
      <div ref={containerRef} className="relative flex min-w-0 flex-[2_1_220px] flex-col">
        <label className="flex flex-col gap-0.5 rounded-[16px] bg-board px-4 py-2.5 focus-within:ring-2 focus-within:ring-ink">
          <span className="text-[13px] font-semibold text-slate">Where</span>
          <div className="flex items-center gap-2">
            <input
              value={place}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (suggestions.length > 0) setOpen(true); }}
              autoComplete="off"
              spellCheck={false}
              placeholder="SeaTac, Capitol Hill, Bellevue"
              className="w-full min-w-0 bg-transparent text-base font-semibold outline-none placeholder:font-medium placeholder:text-quiet sm:text-[17px]"
            />
            {loading && (
              <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-slate border-t-transparent" />
            )}
          </div>
        </label>

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
                  <span className="block text-xs leading-snug text-slate line-clamp-1">{s.label}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TripDatesPicker
        from={dates.from}
        until={dates.until}
        onChange={(f, u) => setDates({ from: f, until: u })}
        className="flex-[2_1_280px]"
      />
      <button
        type="submit"
        className={cn(
          "flex flex-none items-center justify-center gap-2.5 rounded-[16px] bg-ink px-7 font-bold text-white transition-colors hover:bg-graphite",
          size === "lg" ? "min-h-[56px] text-[17px] sm:min-h-16" : "min-h-[52px] text-base"
        )}
      >
        <Search className="size-5" strokeWidth={2} />
        Search
      </button>
    </form>
  );
}
