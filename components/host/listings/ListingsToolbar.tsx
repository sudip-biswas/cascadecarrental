"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LoaderCircle, Search, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { LISTING_STATES, TRIP_STATES, listingsHref, type ListingsQuery } from "./query";

const chip =
  "flex h-12 shrink-0 items-center gap-1.5 rounded-[14px] px-4 text-[15px] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cobalt";

const chipTone = (active: boolean) => (active ? "bg-ink text-white hover:bg-graphite" : "bg-white text-ink hover:bg-line");

const ANY = "any";

function Filter<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T | null) => void;
}) {
  const picked = options.find((o) => o.value === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(chip, chipTone(!!picked))}>
        {picked ? picked.label : label}
        <ChevronDown className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        <DropdownMenuRadioGroup value={value ?? ANY} onValueChange={(v) => onChange(v === ANY ? null : (v as T))}>
          <DropdownMenuRadioItem value={ANY}>Any</DropdownMenuRadioItem>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Search and the two status filters. Everything lives in the URL, so a filtered list can be shared or reloaded. */
export function ListingsToolbar({ query }: { query: ListingsQuery }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(query.q);
  const [seenQ, setSeenQ] = useState(query.q);
  // A link elsewhere (like "Clear filters") changed the search: show that.
  if (query.q !== seenQ) {
    setSeenQ(query.q);
    setText(query.q);
  }

  function go(change: Partial<ListingsQuery>) {
    startTransition(() => router.replace(listingsHref(query, change), { scroll: false }));
  }

  // Search as you type, a beat after the last key.
  useEffect(() => {
    const q = text.trim();
    if (q === query.q) return;
    const timer = setTimeout(() => startTransition(() => router.replace(listingsHref(query, { q }), { scroll: false })), 250);
    return () => clearTimeout(timer);
  }, [text, query, router]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative flex min-w-0 flex-[1_1_260px] items-center sm:max-w-[420px]">
        <span className="sr-only">Search your cars</span>
        {pending ? (
          <LoaderCircle className="pointer-events-none absolute left-4 size-[18px] animate-spin text-slate" />
        ) : (
          <Search className="pointer-events-none absolute left-4 size-[18px] text-slate" />
        )}
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Make, model, plate #"
          className="h-12 w-full min-w-0 rounded-[14px] bg-white pr-10 pl-11 text-base text-ink outline-none placeholder:text-quiet focus-visible:ring-2 focus-visible:ring-ink [&::-webkit-search-cancel-button]:hidden"
        />
        {text && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setText("")}
            className="absolute right-2 flex size-8 items-center justify-center rounded-[10px] text-slate hover:bg-board"
          >
            <X className="size-4" />
          </button>
        )}
      </label>
      <Filter label="Trip status" value={query.trip} options={TRIP_STATES} onChange={(trip) => go({ trip })} />
      <Filter label="Listing status" value={query.listing} options={LISTING_STATES} onChange={(listing) => go({ listing })} />
    </div>
  );
}
