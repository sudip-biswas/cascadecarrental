"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type RatingsFilter = {
  /** Search param it lives in. */
  name: string;
  label: string;
  /** The value that means "no filter", left out of the URL. */
  fallback: string;
  options: { value: string; label: string }[];
};

/** Dropdowns that keep their choice in the URL, so the server page reads them. */
export function RatingsFilters({ filters }: { filters: RatingsFilter[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(filter: RatingsFilter, value: string) {
    const next = new URLSearchParams(params);
    if (value === filter.fallback) next.delete(filter.name);
    else next.set(filter.name, value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <>
      {filters.map((f) => {
        const current = params.get(f.name);
        const value = f.options.some((o) => o.value === current) ? current! : f.fallback;
        return (
          <Select key={f.name} value={value} onValueChange={(v) => set(f, v)}>
            <SelectTrigger size="sm" className="bg-white text-[15px] font-bold hover:bg-white/70" aria-label={f.label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      })}
    </>
  );
}
