"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn, pluralize } from "@/lib/utils";
import { FEATURES, FUEL_TYPES, TRANSMISSIONS, VEHICLE_TYPES, typeLabel } from "./categories";
import type { FilterOptions } from "./listings";
import { parseSearchParams, type SearchFilters, type SortKey } from "./params";
import type { SearchStats } from "./search";

/** The URL params a filter menu is editing before the guest applies them. */
export type Draft = Record<string, string>;
export type SetDraft = (changes: Record<string, string | null>) => void;

export interface SectionProps {
  filters: SearchFilters;
  set: SetDraft;
  options: FilterOptions;
  stats: SearchStats | null;
}

/** Draft params with a setter that drops empty values. */
export function useDraft(initial: Draft) {
  const [draft, setDraft] = useState(initial);
  const set: SetDraft = (changes) =>
    setDraft((current) => {
      const next = { ...current };
      for (const [key, value] of Object.entries(changes)) {
        if (value) next[key] = value;
        else delete next[key];
      }
      return next;
    });
  return { draft, set, reset: setDraft, filters: parseSearchParams(draft) };
}

/** Counts the cars a draft would show, a moment after the guest stops changing it. */
export function useSearchStats(draft: Draft, enabled: boolean) {
  const qs = new URLSearchParams(draft).toString();
  const [result, setResult] = useState<{ qs: string; stats: SearchStats } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/search/count?${qs}`, { signal: controller.signal });
        if (res.ok) setResult({ qs, stats: await res.json() });
      } catch {
        // Aborted or offline: the button keeps the last count.
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [qs, enabled]);

  return { stats: result?.stats ?? null, loading: result?.qs !== qs };
}

export function showLabel(stats: SearchStats | null) {
  if (!stats) return "Show cars";
  return stats.count ? `Show ${pluralize(stats.count, "car")}` : "No cars match";
}

function toggled(list: string[], value: string) {
  return (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]).join(",") || null;
}

export function Choice({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] px-3.5 text-[15px] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cobalt",
        active ? "bg-ink text-white hover:bg-graphite" : "bg-board text-ink hover:bg-line",
        className
      )}
    >
      {children}
    </button>
  );
}

function Choices({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

/** One pick from a short list, with "Any" to clear it. */
function OneOf<T extends string | number>({
  value,
  choices,
  onChange,
}: {
  value: T | null;
  choices: { value: T; label: string }[];
  onChange: (value: T | null) => void;
}) {
  return (
    <Choices>
      <Choice active={value === null} onClick={() => onChange(null)}>
        Any
      </Choice>
      {choices.map((c) => (
        <Choice key={c.value} active={value === c.value} onClick={() => onChange(value === c.value ? null : c.value)}>
          {c.label}
        </Choice>
      ))}
    </Choices>
  );
}

export function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between gap-4 rounded-[14px] py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-cobalt"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-[15px] font-bold">{label}</span>
        {hint && <span className="text-sm text-slate">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative inline-flex h-[26px] w-11 shrink-0 items-center rounded-[8px] px-[3px] transition-colors",
          on ? "bg-cobalt" : "bg-line"
        )}
      >
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-[6px] bg-white transition-transform",
            on && "translate-x-[18px]"
          )}
        >
          {on && <Check className="size-3.5 text-cobalt" strokeWidth={3} />}
        </span>
      </span>
    </button>
  );
}

export function sortChoices(filters: SearchFilters): { value: SortKey; label: string }[] {
  return [
    { value: "price", label: filters.dates ? "Lowest total" : "Lowest price" },
    { value: "price_high", label: filters.dates ? "Highest total" : "Highest price" },
    ...(filters.lat !== null ? [{ value: "distance" as const, label: "Closest first" }] : []),
    { value: "rating", label: "Top rated" },
    { value: "newest", label: "Newest" },
  ];
}

export function SortSection({ filters, set }: SectionProps) {
  return (
    <Choices>
      {sortChoices(filters).map((s) => (
        <Choice key={s.value} active={filters.sort === s.value} onClick={() => set({ sort: s.value === "price" ? null : s.value })}>
          {s.label}
        </Choice>
      ))}
    </Choices>
  );
}

/** Bars of how many cars sit at each daily price, lit inside the picked range. */
function Histogram({ prices, top, low, high }: { prices: number[]; top: number; low: number; high: number }) {
  const width = Math.max(5, Math.ceil(top / 24 / 5) * 5);
  const bins = Array.from({ length: Math.ceil(top / width) }, (_, i) => i * width);
  const counts = bins.map(() => 0);
  for (const p of prices) counts[Math.min(bins.length - 1, Math.floor(p / width))]++;
  const tallest = Math.max(1, ...counts);
  return (
    <div aria-hidden className="mb-1 flex h-16 items-end gap-[3px] px-3">
      {bins.map((start, i) => (
        <span
          key={start}
          className={cn(
            "flex-1 rounded-t-[3px] transition-colors",
            start + width > low && start <= high ? "bg-cobalt" : "bg-line"
          )}
          style={{ height: `${counts[i] ? Math.max(10, (counts[i] / tallest) * 100) : 0}%` }}
        />
      ))}
    </div>
  );
}

export function PriceSection({ filters, set, options, stats }: SectionProps) {
  const top = options.maxPrice;
  const low = filters.minPrice ?? 0;
  const high = Math.min(filters.maxPrice ?? top, top);
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <Bound label="Minimum" value={`$${low}`} />
        <Bound label="Maximum" value={`$${high}${high >= top ? "+" : ""}`} />
      </div>
      <div className="flex flex-col pt-2">
        <Histogram prices={stats?.prices ?? []} top={top} low={low} high={high} />
        <Slider
          min={0}
          max={top}
          step={5}
          minStepsBetweenThumbs={1}
          value={[low, high]}
          onValueChange={([min, max]) => set({ minPrice: min > 0 ? String(min) : null, maxPrice: max < top ? String(max) : null })}
          aria-label="Price per day"
          className="[&_[data-slot=slider-range]]:bg-cobalt [&_[data-slot=slider-thumb]]:size-6 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-ink [&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-line"
        />
      </div>
    </div>
  );
}

function Bound({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col gap-0.5 rounded-[14px] bg-board px-3.5 py-2.5">
      <span className="text-[13px] font-semibold text-slate">{label}</span>
      <span className="figures text-[17px] font-extrabold">{value}</span>
    </span>
  );
}

export function TypeSection({ filters, set }: SectionProps) {
  return (
    <Choices>
      {VEHICLE_TYPES.map((t) => (
        <Choice key={t.value} active={filters.types.includes(t.value)} onClick={() => set({ type: toggled(filters.types, t.value) })}>
          {t.label}
        </Choice>
      ))}
    </Choices>
  );
}

export function MakeSection({ filters, set, options }: SectionProps) {
  const picked = new Set([...filters.makes, ...filters.models.map((m) => m.split(":")[0])]);

  function toggleMake(make: string) {
    if (picked.has(make)) {
      set({
        make: filters.makes.filter((m) => m !== make).join(",") || null,
        model: filters.models.filter((m) => !m.startsWith(`${make}:`)).join(",") || null,
      });
    } else {
      set({ make: [...filters.makes, make].join(",") });
    }
  }

  if (!options.makes.length) return <p className="text-[15px] text-slate">No cars listed yet.</p>;
  return (
    <div className="flex flex-col gap-4">
      <Choices>
        {options.makes.map(({ make }) => (
          <Choice key={make} active={picked.has(make)} onClick={() => toggleMake(make)}>
            {make}
          </Choice>
        ))}
      </Choices>
      {options.makes
        .filter(({ make, models }) => picked.has(make) && models.length > 1)
        .map(({ make, models }) => {
          const chosen = filters.models.filter((m) => m.startsWith(`${make}:`));
          return (
            <div key={make} className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate">{make} models</span>
              <Choices>
                <Choice
                  active={!chosen.length}
                  onClick={() => set({ model: filters.models.filter((m) => !m.startsWith(`${make}:`)).join(",") || null })}
                >
                  Any {make}
                </Choice>
                {models.map((model) => (
                  <Choice
                    key={model}
                    active={chosen.includes(`${make}:${model}`)}
                    onClick={() => set({ model: toggled(filters.models, `${make}:${model}`) })}
                  >
                    {model}
                  </Choice>
                ))}
              </Choices>
            </div>
          );
        })}
    </div>
  );
}

export function YearsSection({ filters, set, options }: SectionProps) {
  const span = options.years ?? { min: new Date().getFullYear(), max: new Date().getFullYear() };
  const years = Array.from({ length: span.max - span.min + 1 }, (_, i) => span.max - i);
  const select =
    "h-12 w-full appearance-none rounded-[14px] bg-board px-3.5 text-[16px] font-bold outline-none focus-visible:ring-2 focus-visible:ring-cobalt";
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-slate">From</span>
        <select
          className={select}
          value={filters.minYear ?? ""}
          onChange={(e) => set({ minYear: e.target.value || null })}
        >
          <option value="">Any year</option>
          {years.map((y) => (
            <option key={y} value={y} disabled={filters.maxYear !== null && y > filters.maxYear}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold text-slate">To</span>
        <select
          className={select}
          value={filters.maxYear ?? ""}
          onChange={(e) => set({ maxYear: e.target.value || null })}
        >
          <option value="">Any year</option>
          {years.map((y) => (
            <option key={y} value={y} disabled={filters.minYear !== null && y < filters.minYear}>
              {y}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function SeatsSection({ filters, set }: SectionProps) {
  return (
    <OneOf
      value={filters.minSeats}
      choices={[4, 5, 6, 7, 8].map((n) => ({ value: n, label: `${n}+` }))}
      onChange={(n) => set({ seats: n ? String(n) : null })}
    />
  );
}

export function MpgSection({ filters, set }: SectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <OneOf
        value={filters.minMpg}
        choices={[25, 35, 45].map((n) => ({ value: n, label: `${n}+ MPG` }))}
        onChange={(n) => set({ mpg: n ? String(n) : null })}
      />
      <p className="text-sm text-slate">Electric cars count as the most efficient.</p>
    </div>
  );
}

export function TransmissionSection({ filters, set }: SectionProps) {
  return (
    <OneOf
      value={filters.transmission}
      choices={TRANSMISSIONS as { value: "automatic" | "manual"; label: string }[]}
      onChange={(t) => set({ transmission: t })}
    />
  );
}

export function FuelSection({ filters, set }: SectionProps) {
  return (
    <Choices>
      {FUEL_TYPES.map((f) => (
        <Choice key={f.value} active={filters.fuels.includes(f.value)} onClick={() => set({ fuel: toggled(filters.fuels, f.value) })}>
          {f.label}
        </Choice>
      ))}
    </Choices>
  );
}

export function FeaturesSection({ filters, set }: SectionProps) {
  return (
    <Choices>
      {FEATURES.map((f) => (
        <Choice
          key={f.value}
          active={filters.features.includes(f.value)}
          onClick={() => set({ features: toggled(filters.features, f.value) })}
        >
          {f.label}
        </Choice>
      ))}
    </Choices>
  );
}

export function MilesSection({ filters, set }: SectionProps) {
  return (
    <OneOf
      value={filters.miles === null ? null : String(filters.miles)}
      choices={[
        { value: "100", label: "100+ mi/day" },
        { value: "200", label: "200+ mi/day" },
        { value: "300", label: "300+ mi/day" },
        { value: "unlimited", label: "Unlimited miles" },
      ]}
      onChange={(m) => set({ miles: m })}
    />
  );
}

export function DeliverySection({ filters, set }: SectionProps) {
  return (
    <Toggle
      on={filters.delivery}
      onChange={(on) => set({ deliver: on ? "1" : null })}
      label="Host brings the car to me"
      hint="Only cars with delivery. You add the address when you book."
    />
  );
}

export function MoreSection({ filters, set }: SectionProps) {
  return (
    <div className="flex flex-col gap-3">
      <Toggle
        on={filters.instant}
        onChange={(on) => set({ instant: on ? "1" : null })}
        label="Instant book"
        hint="Book without waiting for the host to say yes."
      />
      <Toggle
        on={filters.nearSea}
        onChange={(on) => set({ near: on ? "sea" : null })}
        label="Near SEA"
        hint="Parked within about ten miles of the airport."
      />
      <Toggle
        on={filters.weekDiscount}
        onChange={(on) => set({ discount: on ? "week" : null })}
        label="Week discount"
        hint="Hosts who take money off trips of a week or more."
      />
    </div>
  );
}

/** Short pill text for the picked types, e.g. "SUV" or "Type · 2". */
export function typesLabel(types: string[]) {
  return types.length === 1 ? typeLabel(types[0]) : types.length ? `Type · ${types.length}` : "Vehicle type";
}
