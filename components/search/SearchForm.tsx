"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { TripDatesPicker } from "./TripDatesPicker";
import type { DateKey } from "./dates";

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

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams(keep);
    const trimmed = place.trim();
    if (trimmed) params.set("where", trimmed);
    else params.delete("where");
    if (dates.from && dates.until) {
      params.set("from", dates.from);
      params.set("until", dates.until);
    } else {
      params.delete("from");
      params.delete("until");
    }
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search");
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
      <label className="flex min-w-0 flex-[2_1_220px] flex-col gap-0.5 rounded-[16px] bg-board px-4 py-2.5 focus-within:ring-2 focus-within:ring-ink">
        <span className="text-[13px] font-semibold text-slate">Where</span>
        <input
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          placeholder="SeaTac, Capitol Hill, Bellevue"
          className="w-full min-w-0 bg-transparent text-base font-semibold outline-none placeholder:font-medium placeholder:text-quiet sm:text-[17px]"
        />
      </label>
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
