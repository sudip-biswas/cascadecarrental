"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";
const TRIGGER = "min-w-[150px] bg-white text-[15px] font-bold hover:bg-white/70";

/** Car and year pickers. They live in the URL so the CSV download matches what's on screen. */
export function EarningsFilters({
  cars,
  years,
  year,
}: {
  cars?: { id: string; name: string }[];
  years: string[];
  year: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: "car" | "year", value: string) {
    const next = new URLSearchParams(params);
    if (value === ALL) next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <>
      {cars && (
        <Select value={params.get("car") ?? ALL} onValueChange={(v) => set("car", v)}>
          <SelectTrigger size="sm" className={TRIGGER} aria-label="Car">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All cars</SelectItem>
            {cars.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={year} onValueChange={(v) => set("year", v)}>
        <SelectTrigger size="sm" className={TRIGGER} aria-label="Year">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={y}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
