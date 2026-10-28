"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  CalendarClock,
  CalendarDays,
  CarFront,
  LayoutGrid,
  MapPin,
  Navigation,
  MessageSquare,
  Plus,
  ReceiptText,
  Route,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Gavel,
  TicketPercent,
  UserRound,
  Users,
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

export function HostSidebar({ requests, unread, isAdmin = false }: { requests: number; unread: number; isAdmin?: boolean }) {
  const pathname = usePathname();
  const hosting: Item[] = [
    { href: "/host", label: "Today", icon: LayoutGrid, match: (p) => p === "/host", badge: requests },
    { href: "/host/calendar", label: "Calendar", icon: CalendarDays, match: (p) => p.startsWith("/host/calendar") },
    { href: "/host/trips", label: "Trips", icon: Route, match: (p) => p.startsWith("/host/trips") },
    { href: "/host/vehicles", label: "Cars", icon: CarFront, match: (p) => p.startsWith("/host/vehicles") },
    { href: "/host/inbox", label: "Inbox", icon: MessageSquare, match: (p) => p.startsWith("/host/inbox") && !p.startsWith("/host/inbox/scheduled"), badge: unread },
    { href: "/host/inbox/scheduled", label: "Scheduled messages", icon: CalendarClock, match: (p) => p.startsWith("/host/inbox/scheduled") },
    { href: "/host/business/earnings", label: "Earnings", icon: BarChart3, match: (p) => p.startsWith("/host/business/earnings") },
    { href: "/host/business/transactions", label: "Transactions", icon: ReceiptText, match: (p) => p.startsWith("/host/business/transactions") },
    { href: "/host/business/performance", label: "Performance", icon: TrendingUp, match: (p) => p.startsWith("/host/business/performance") },
    { href: "/host/business/ratings", label: "Ratings", icon: Star, match: (p) => p.startsWith("/host/business/ratings") },
    { href: "/host/hours", label: "Pickup and hours", icon: MapPin, match: (p) => p.startsWith("/host/hours") },
    { href: "/host/locations", label: "Locations", icon: Navigation, match: (p) => p.startsWith("/host/locations") },
    { href: "/host/notifications", label: "Notifications", icon: Bell, match: (p) => p.startsWith("/host/notifications") },
  ];
  // Everyone on Cascade, not just this host's cars.
  const admin: Item[] = isAdmin
    ? [
        { href: "/host/admin", label: "Overview", icon: Shield, match: (p) => p === "/host/admin" },
        { href: "/host/admin/disputes", label: "Disputes", icon: Gavel, match: (p) => p.startsWith("/host/admin/disputes") },
        { href: "/host/admin/trips", label: "Every trip", icon: Route, match: (p) => p.startsWith("/host/admin/trips") },
        { href: "/host/admin/users", label: "Users", icon: Users, match: (p) => p.startsWith("/host/admin/users") },
        { href: "/host/admin/promos", label: "Promo codes", icon: TicketPercent, match: (p) => p.startsWith("/host/admin/promos") },
        { href: "/host/admin/pricing", label: "Pricing events", icon: Sparkles, match: (p) => p.startsWith("/host/admin/pricing") },
        { href: "/host/admin/personas", label: "Personas", icon: UserRound, match: (p) => p.startsWith("/host/admin/personas") },
      ]
    : [];

  const nav = (label: string, items: Item[]) => (
    <nav aria-label={label} className="flex flex-col gap-0.5">
      <p className="px-3 pb-1.5 text-[12px] font-bold uppercase tracking-[0.06em] text-[#9a9ea8]">{label}</p>
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
  );

  return (
    <aside className="sticky top-0 hidden h-dvh w-[260px] shrink-0 flex-col gap-[22px] overflow-y-auto bg-ink px-3.5 py-5 text-white lg:flex">
      <Link href="/" className="flex items-center gap-2.5 px-2">
        <LogoMark size={34} onDark />
        <span className="font-display text-[24px] font-extrabold tracking-[-0.03em]">Cascade</span>
        <span className="rounded-[6px] bg-butter px-1.5 py-[3px] text-[12px] font-extrabold text-ink">Host</span>
      </Link>

      {nav("Hosting", hosting)}
      {admin.length > 0 && nav("Cascade admin", admin)}

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
