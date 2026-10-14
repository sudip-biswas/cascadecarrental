"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CarFront,
  LayoutGrid,
  MapPin,
  MessageSquare,
  Plus,
  Route,
  Star,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoMark } from "./Logo";

interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (path: string) => boolean;
  badge?: number;
}

export function HostSidebar({ requests, unread }: { requests: number; unread: number }) {
  const pathname = usePathname();
  const items: Item[] = [
    { href: "/host", label: "Today", icon: LayoutGrid, match: (p) => p === "/host", badge: requests },
    { href: "/host/calendar", label: "Calendar", icon: CalendarDays, match: (p) => p.startsWith("/host/calendar") },
    { href: "/host/trips", label: "Trips", icon: Route, match: (p) => p.startsWith("/host/trips") },
    { href: "/host/vehicles", label: "Cars", icon: CarFront, match: (p) => p.startsWith("/host/vehicles") },
    { href: "/host/inbox", label: "Inbox", icon: MessageSquare, match: (p) => p.startsWith("/host/inbox"), badge: unread },
    { href: "/host/business/earnings", label: "Earnings", icon: BarChart3, match: (p) => p.startsWith("/host/business/earnings") },
    { href: "/host/business/performance", label: "Performance", icon: TrendingUp, match: (p) => p.startsWith("/host/business/performance") },
    { href: "/host/business/ratings", label: "Ratings", icon: Star, match: (p) => p.startsWith("/host/business/ratings") },
    { href: "/host/hours", label: "Pickup and hours", icon: MapPin, match: (p) => p.startsWith("/host/hours") },
    { href: "/host/notifications", label: "Notifications", icon: Bell, match: (p) => p.startsWith("/host/notifications") },
  ];

  return (
    <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col gap-[22px] overflow-y-auto bg-ink px-3.5 py-5 text-white lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-2">
        <LogoMark size={34} onDark />
        <span className="font-display text-[24px] font-extrabold tracking-[-0.03em]">Cascade</span>
        <span className="rounded-[6px] bg-butter px-1.5 py-[3px] text-[12px] font-extrabold text-ink">Host</span>
      </Link>

      <nav aria-label="Hosting" className="flex flex-col gap-0.5">
        {items.map(({ href, label, icon: Icon, match, badge }) => {
          const on = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-[12px] px-3 py-[11px] text-[15px] transition-colors",
                on ? "bg-white font-bold text-ink" : "font-medium text-white hover:bg-graphite"
              )}
            >
              <Icon className="size-5" strokeWidth={1.75} />
              <span className="flex-1">{label}</span>
              {badge ? (
                <span className="rounded-[7px] bg-cobalt px-[7px] py-px text-[12px] font-extrabold text-white">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        <Link
          href="/host/vehicles/new"
          className="flex items-center justify-center gap-2 rounded-[13px] bg-butter p-3.5 text-[15px] font-bold text-ink transition-colors hover:bg-[#ffdf80]"
        >
          <Plus className="size-[18px]" strokeWidth={2} />
          List a car
        </Link>
        <Link href="/" className="px-2.5 py-2 text-sm font-semibold text-[#c9ccd3] hover:text-white">
          Switch to renting
        </Link>
      </div>
    </aside>
  );
}
