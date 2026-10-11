"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface FilterChipProps {
  label: string;
  active?: boolean;
  children: React.ReactNode;
}

function FilterChip({ label, active, children }: FilterChipProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "gap-1 rounded-full border font-medium text-sm shrink-0",
            active
              ? "bg-cascade-900 text-white border-cascade-900 hover:bg-cascade-700 hover:text-white"
              : "bg-white hover:border-cascade-500"
          )}
        >
          {label}
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const VEHICLE_TYPES = ["Sedan", "SUV", "Truck", "Van", "Sports", "Luxury", "Electric"];
const SEAT_OPTIONS = ["2", "4", "5", "6", "7", "8+"];
const FUEL_TYPES = ["Gas", "Hybrid", "Electric", "Diesel"];

export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/search?${params.toString()}`);
  }

  function toggleMulti(key: string, value: string) {
    const current = searchParams.get(key)?.split(",").filter(Boolean) ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    updateParam(key, next.length ? next.join(",") : null);
  }

  const activeTypes = searchParams.get("type")?.split(",") ?? [];
  const activeSeats = searchParams.get("seats")?.split(",") ?? [];
  const activeFuels = searchParams.get("fuel")?.split(",") ?? [];

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {/* Vehicle type */}
      <FilterChip label="Vehicle type" active={activeTypes.length > 0}>
        {VEHICLE_TYPES.map((type) => (
          <DropdownMenuCheckboxItem
            key={type}
            checked={activeTypes.includes(type.toLowerCase())}
            onCheckedChange={() => toggleMulti("type", type.toLowerCase())}
          >
            {type}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterChip>

      {/* Seats */}
      <FilterChip label="Seats" active={activeSeats.length > 0}>
        {SEAT_OPTIONS.map((s) => (
          <DropdownMenuCheckboxItem
            key={s}
            checked={activeSeats.includes(s)}
            onCheckedChange={() => toggleMulti("seats", s)}
          >
            {s === "8+" ? "8 or more" : `${s} seats`}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterChip>

      {/* Fuel type */}
      <FilterChip label="Fuel type" active={activeFuels.length > 0}>
        {FUEL_TYPES.map((f) => (
          <DropdownMenuCheckboxItem
            key={f}
            checked={activeFuels.includes(f.toLowerCase())}
            onCheckedChange={() => toggleMulti("fuel", f.toLowerCase())}
          >
            {f}
          </DropdownMenuCheckboxItem>
        ))}
      </FilterChip>

      {/* Price filter */}
      <FilterChip
        label="Price"
        active={!!(searchParams.get("minPrice") || searchParams.get("maxPrice"))}
      >
        {[50, 75, 100, 150, 200].map((max) => (
          <DropdownMenuCheckboxItem
            key={max}
            checked={searchParams.get("maxPrice") === String(max)}
            onCheckedChange={() =>
              updateParam(
                "maxPrice",
                searchParams.get("maxPrice") === String(max) ? null : String(max)
              )
            }
          >
            Under ${max}/day
          </DropdownMenuCheckboxItem>
        ))}
      </FilterChip>

      <div className="flex-1" />

      <Button
        variant="outline"
        size="sm"
        className="gap-2 rounded-full shrink-0"
        onClick={() => router.push("/search")}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        All filters
      </Button>
    </div>
  );
}
