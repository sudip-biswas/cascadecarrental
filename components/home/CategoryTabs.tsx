"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Plane, CalendarDays, Navigation, Truck, Building2, Car } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { id: "all", label: "All", icon: Car },
  { id: "airports", label: "Airports", icon: Plane },
  { id: "monthly", label: "Monthly", icon: CalendarDays },
  { id: "nearby", label: "Nearby", icon: Navigation },
  { id: "delivered", label: "Delivered", icon: Truck },
  { id: "cities", label: "Cities", icon: Building2 },
] as const;

export function CategoryTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("category") ?? "all";

  function select(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "all") {
      params.delete("category");
    } else {
      params.set("category", id);
    }
    router.push(`/search?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {CATEGORIES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => select(id)}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
            active === id
              ? "bg-cascade-900 text-white border-cascade-900"
              : "bg-white text-slate-700 border-border hover:border-cascade-300 hover:text-cascade-700"
          )}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );
}
