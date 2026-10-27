"use client";

import { useState, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, ChevronDown, Truck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fuelLabel } from "./categories";
import { AllFilters } from "./AllFilters";
import type { FilterOptions } from "./listings";
import { FILTER_KEYS, parseSearchParams, type SearchFilters } from "./params";
import {
  FuelSection,
  MakeSection,
  MpgSection,
  PriceSection,
  SeatsSection,
  TypeSection,
  YearsSection,
  showLabel,
  sortChoices,
  typesLabel,
  useDraft,
  useSearchStats,
  type SectionProps,
} from "./FilterSections";

const chip =
  "flex h-11 shrink-0 items-center gap-1.5 rounded-[12px] px-3.5 text-[15px] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cobalt";

function chipTone(active: boolean) {
  return active ? "bg-ink text-white hover:bg-graphite" : "bg-white text-ink hover:bg-line";
}

interface Pill {
  /** URL params this pill sets, cleared by its Clear button. */
  keys: string[];
  label: (f: SearchFilters) => string | null;
  idle: string;
  Section: ComponentType<SectionProps>;
  wide?: boolean;
}

function priceLabel(f: SearchFilters) {
  if (f.minPrice && f.maxPrice) return `$${f.minPrice}–$${f.maxPrice}`;
  if (f.maxPrice) return `Up to $${f.maxPrice}`;
  if (f.minPrice) return `$${f.minPrice}+ a day`;
  return null;
}

function yearsLabel(f: SearchFilters) {
  if (f.minYear && f.maxYear) return f.minYear === f.maxYear ? String(f.minYear) : `${f.minYear}–${f.maxYear}`;
  if (f.minYear) return `${f.minYear} or newer`;
  if (f.maxYear) return `${f.maxYear} or older`;
  return null;
}

function makesLabel(f: SearchFilters) {
  const makes = new Set([...f.makes, ...f.models.map((m) => m.split(":")[0])]);
  if (!makes.size) return null;
  if (f.models.length === 1 && makes.size === 1) return f.models[0].replace(":", " ");
  return makes.size === 1 ? [...makes][0] : `Makes · ${makes.size}`;
}

/** Turo's quick filters, in Turo's order. The rest live in All filters. */
const PILLS: Pill[] = [
  { keys: ["minPrice", "maxPrice"], idle: "Price", label: priceLabel, Section: PriceSection, wide: true },
  { keys: ["type"], idle: "Vehicle type", label: (f) => (f.types.length ? typesLabel(f.types) : null), Section: TypeSection },
  { keys: ["make", "model"], idle: "Make & model", label: makesLabel, Section: MakeSection, wide: true },
  { keys: ["minYear", "maxYear"], idle: "Years", label: yearsLabel, Section: YearsSection },
  { keys: ["seats"], idle: "Seats", label: (f) => (f.minSeats ? `${f.minSeats}+ seats` : null), Section: SeatsSection },
  { keys: ["mpg"], idle: "Fuel efficiency", label: (f) => (f.minMpg ? `${f.minMpg}+ MPG` : null), Section: MpgSection },
  {
    keys: ["fuel"],
    idle: "Fuel type",
    label: (f) => (f.fuels.length === 1 ? fuelLabel(f.fuels[0]) : f.fuels.length ? `Fuel · ${f.fuels.length}` : null),
    Section: FuelSection,
  },
];

function href(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return qs ? `/search?${qs}` : "/search";
}

function FilterPill({ pill, filters, options }: { pill: Pill; filters: SearchFilters; options: FilterOptions }) {
  const [open, setOpen] = useState(false);
  const label = pill.label(filters);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger data-pill={pill.idle} className={cn(chip, chipTone(label !== null))}>
        {label ?? pill.idle}
        <ChevronDown className="size-4" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className={cn("gap-4 rounded-[22px] bg-white p-4", pill.wide ? "w-[min(400px,calc(100vw-2rem))]" : "w-[min(340px,calc(100vw-2rem))]")}
      >
        {open && <PillPanel pill={pill} options={options} onDone={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}

function PillPanel({ pill, options, onDone }: { pill: Pill; options: FilterOptions; onDone: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { draft, set, filters } = useDraft(Object.fromEntries(searchParams));
  const { stats, loading } = useSearchStats(draft, true);
  const { Section } = pill;

  function apply() {
    router.push(href(draft), { scroll: false });
    onDone();
  }

  return (
    <>
      <span className="text-[17px] font-extrabold">{pill.idle}</span>
      <Section filters={filters} set={set} options={options} stats={stats} />
      <div className="flex items-center justify-between gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries(pill.keys.map((k) => [k, null])))}>
          Clear
        </Button>
        <Button size="sm" onClick={apply} disabled={stats?.count === 0} aria-busy={loading}>
          {showLabel(stats)}
        </Button>
      </div>
    </>
  );
}

export function FilterBar({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseSearchParams(Object.fromEntries(searchParams));

  function update(changes: Record<string, string | null>) {
    const params = Object.fromEntries(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value) params[key] = value;
      else delete params[key];
    }
    router.push(href(params), { scroll: false });
  }

  const anyFilter = FILTER_KEYS.some((key) => searchParams.has(key));

  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      <AllFilters options={options} data-all-filters="" />

      {PILLS.map((pill) => (
        <FilterPill key={pill.idle} pill={pill} filters={filters} options={options} />
      ))}

      <button
        type="button"
        aria-pressed={filters.delivery}
        onClick={() => update({ deliver: filters.delivery ? null : "1" })}
        className={cn(chip, chipTone(filters.delivery))}
      >
        <Truck className="size-[18px]" strokeWidth={2} />
        Deliver to me
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
    </div>
  );
}

/** The order of the results, beside the list and map switch. */
export function SortMenu() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = parseSearchParams(Object.fromEntries(searchParams));
  const sorts = sortChoices(filters);

  function choose(sort: string) {
    const params = Object.fromEntries(searchParams);
    if (sort === "price") delete params.sort;
    else params.sort = sort;
    router.push(href(params), { scroll: false });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(chip, "bg-white font-bold text-ink hover:bg-line")}>
        <ArrowDownUp className="size-[18px]" strokeWidth={2} />
        {sorts.find((s) => s.value === filters.sort)?.label}
        <ChevronDown className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup value={filters.sort} onValueChange={choose}>
          {sorts.map((s) => (
            <DropdownMenuRadioItem key={s.value} value={s.value}>
              {s.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
