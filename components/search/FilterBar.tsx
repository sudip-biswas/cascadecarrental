"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, PlaneLanding } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FUEL_TYPES, VEHICLE_TYPES } from "./categories";
import { FILTER_KEYS, parseSearchParams, type SortKey } from "./params";

const chip =
  "flex h-11 shrink-0 items-center gap-1.5 rounded-[12px] px-3.5 text-[15px] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cobalt";

function chipTone(active: boolean) {
  return active ? "bg-ink text-white hover:bg-graphite" : "bg-white text-ink hover:bg-line";
}

const SEATS = [
  { value: "", label: "Any" },
  { value: "4", label: "4 or more" },
  { value: "5", label: "5 or more" },
  { value: "7", label: "7 or more" },
];

const PRICES = [
  { value: "", label: "Any price" },
  { value: "50", label: "Up to $50" },
  { value: "75", label: "Up to $75" },
  { value: "100", label: "Up to $100" },
  { value: "150", label: "Up to $150" },
];

export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseSearchParams(Object.fromEntries(searchParams));
  const hasDates = !!filters.dates;

  const sorts: { value: SortKey; label: string }[] = [
    { value: "price", label: hasDates ? "Lowest total" : "Lowest price" },
    { value: "rating", label: "Top rated" },
    { value: "newest", label: "Newest" },
  ];

  function update(changes: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const qs = params.toString();
    router.push(qs ? `/search?${qs}` : "/search", { scroll: false });
  }

  function toggleIn(key: string, current: string[], value: string) {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    update({ [key]: next.join(",") || null });
  }

  const anyFilter = FILTER_KEYS.some((key) => searchParams.has(key));

  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      <button
        type="button"
        aria-pressed={filters.nearSea}
        onClick={() => update({ near: filters.nearSea ? null : "sea" })}
        className={cn(chip, chipTone(filters.nearSea))}
      >
        <PlaneLanding className="size-[18px]" strokeWidth={2} />
        Near SEA
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger className={cn(chip, chipTone(filters.types.length > 0))}>
          {filters.types.length ? `Type · ${filters.types.length}` : "Type"}
          <ChevronDown className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {VEHICLE_TYPES.map((t) => (
            <DropdownMenuCheckboxItem
              key={t.value}
              checked={filters.types.includes(t.value)}
              onCheckedChange={() => toggleIn("type", filters.types, t.value)}
              onSelect={(e) => e.preventDefault()}
            >
              {t.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className={cn(chip, chipTone(filters.minSeats !== null))}>
          {filters.minSeats ? `${filters.minSeats}+ seats` : "Seats"}
          <ChevronDown className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuRadioGroup
            value={filters.minSeats ? String(filters.minSeats) : ""}
            onValueChange={(v) => update({ seats: v || null })}
          >
            {SEATS.map((s) => (
              <DropdownMenuRadioItem key={s.value} value={s.value}>
                {s.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className={cn(chip, chipTone(filters.fuels.length > 0))}>
          {filters.fuels.length ? `Fuel · ${filters.fuels.length}` : "Fuel"}
          <ChevronDown className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {FUEL_TYPES.map((f) => (
            <DropdownMenuCheckboxItem
              key={f.value}
              checked={filters.fuels.includes(f.value)}
              onCheckedChange={() => toggleIn("fuel", filters.fuels, f.value)}
              onSelect={(e) => e.preventDefault()}
            >
              {f.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger className={cn(chip, chipTone(filters.maxPrice !== null))}>
          {filters.maxPrice ? `Up to $${filters.maxPrice}/day` : "Price per day"}
          <ChevronDown className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuRadioGroup
            value={filters.maxPrice ? String(filters.maxPrice) : ""}
            onValueChange={(v) => update({ maxPrice: v || null })}
          >
            {PRICES.map((p) => (
              <DropdownMenuRadioItem key={p.value} value={p.value}>
                {p.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <button
        type="button"
        aria-pressed={filters.weekDiscount}
        onClick={() => update({ discount: filters.weekDiscount ? null : "week" })}
        className={cn(chip, chipTone(filters.weekDiscount))}
      >
        Week discount
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={filters.instant}
        onClick={() => update({ instant: filters.instant ? null : "1" })}
        className={cn(chip, "gap-2.5 bg-white text-ink hover:bg-line")}
      >
        <span
          aria-hidden
          className={cn(
            "relative inline-flex h-[22px] w-9 items-center rounded-[7px] px-[3px] transition-colors",
            filters.instant ? "bg-cobalt" : "bg-line"
          )}
        >
          <span
            className={cn(
              "flex size-4 items-center justify-center rounded-[5px] bg-white transition-transform",
              filters.instant && "translate-x-[14px]"
            )}
          >
            {filters.instant && <Check className="size-3 text-cobalt" strokeWidth={3} />}
          </span>
        </span>
        Instant book
      </button>

      {anyFilter && (
        <button
          type="button"
          onClick={() => update(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])))}
          className={cn(chip, "text-slate hover:bg-white hover:text-ink")}
        >
          Clear
        </button>
      )}

      <span className="ml-auto flex shrink-0 items-center gap-2 text-[15px] text-slate">
        <span className="hidden sm:inline">Sort</span>
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(chip, "bg-white font-bold text-ink hover:bg-line")}>
            {sorts.find((s) => s.value === filters.sort)?.label}
            <ChevronDown className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuRadioGroup
              value={filters.sort}
              onValueChange={(v) => update({ sort: v === "price" ? null : v })}
            >
              {sorts.map((s) => (
                <DropdownMenuRadioItem key={s.value} value={s.value}>
                  {s.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  );
}
