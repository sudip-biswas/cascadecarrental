"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL = "all";

/** Car and year pickers for trip history. They live in the URL so the CSV export matches. */
export function HistoryFilters({ cars, years }: { cars: { id: string; name: string }[]; years: string[] }) {
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
      <Select value={params.get("car") ?? ALL} onValueChange={(v) => set("car", v)}>
        <SelectTrigger size="sm" className="bg-white text-[15px] font-bold hover:bg-white/70" aria-label="Car">
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
      <Select value={params.get("year") ?? ALL} onValueChange={(v) => set("year", v)}>
        <SelectTrigger size="sm" className="bg-white text-[15px] font-bold hover:bg-white/70" aria-label="Year">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All years</SelectItem>
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
