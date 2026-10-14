import Link from "next/link";
import { cn } from "@/lib/utils";

export type TripView = "requests" | "upcoming" | "active";

/** Requests / Upcoming / On the road / History, as links so each view has its own URL. */
export function TripTabs({ current, counts }: { current: TripView | "history"; counts: Record<TripView, number> }) {
  const tabs: { key: TripView | "history"; label: string; href: string }[] = [
    { key: "requests", label: counts.requests ? `Requests · ${counts.requests}` : "Requests", href: "/host/trips?show=requests" },
    { key: "upcoming", label: counts.upcoming ? `Upcoming · ${counts.upcoming}` : "Upcoming", href: "/host/trips?show=upcoming" },
    { key: "active", label: counts.active ? `On the road · ${counts.active}` : "On the road", href: "/host/trips?show=active" },
    { key: "history", label: "History", href: "/host/trips/history" },
  ];

  return (
    <nav aria-label="Trips" className="flex max-w-full gap-1 overflow-x-auto rounded-[16px] bg-white p-[5px]">
      {tabs.map((tab) => {
        const on = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-11 shrink-0 items-center rounded-[12px] px-3.5 text-[15px] whitespace-nowrap transition-colors",
              on ? "bg-ink font-bold text-white" : "font-semibold hover:bg-board"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
