"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CarFront, House, MessageSquare, Search, User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Paths that light this tab up. */
  match: (path: string) => boolean;
  badge?: number;
}

/** Screens with their own bottom bar (booking, a message thread) hide the tabs. */
const HIDE_ON = [/^\/cars\//, /^\/messages\/.+/, /^\/host\/inbox\/.+/];

export function PhoneTabs({
  mode,
  signedIn = true,
  inboxBadge = 0,
  todayBadge = 0,
}: {
  mode: "guest" | "host";
  signedIn?: boolean;
  inboxBadge?: number;
  todayBadge?: number;
}) {
  const pathname = usePathname();
  if (HIDE_ON.some((re) => re.test(pathname))) return null;

  const tabs: Tab[] =
    mode === "host"
      ? [
          { href: "/host", label: "Today", icon: House, match: (p) => p === "/host", badge: todayBadge },
          { href: "/host/vehicles", label: "Cars", icon: CarFront, match: (p) => p.startsWith("/host/vehicles") },
          { href: "/host/calendar", label: "Calendar", icon: CalendarDays, match: (p) => p.startsWith("/host/calendar") },
          { href: "/host/inbox", label: "Inbox", icon: MessageSquare, match: (p) => p.startsWith("/host/inbox"), badge: inboxBadge },
        ]
      : [
          { href: "/", label: "Explore", icon: Search, match: (p) => p === "/" || p.startsWith("/search") },
          { href: "/trips", label: "Trips", icon: CarFront, match: (p) => p.startsWith("/trips") },
          { href: "/messages", label: "Inbox", icon: MessageSquare, match: (p) => p.startsWith("/messages"), badge: inboxBadge },
          {
            href: signedIn ? "/profile" : "/login",
            label: signedIn ? "Profile" : "Sign in",
            icon: User,
            match: (p) => p.startsWith("/profile") || p.startsWith("/login"),
          },
        ];

  return (
    <>
      {/* Keeps the last bit of the page clear of the bar. */}
      <div aria-hidden className="h-[calc(76px+env(safe-area-inset-bottom))] md:hidden" />
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 gap-1 bg-white px-2.5 pt-2 pb-[calc(10px+env(safe-area-inset-bottom))] md:hidden"
      >
        {tabs.map(({ href, label, icon: Icon, match, badge }) => {
          const on = match(pathname);
          return (
            <Link
              key={label}
              href={href}
              aria-current={on ? "page" : undefined}
              className="relative flex flex-col items-center gap-[3px] text-ink"
            >
              <span className={cn("flex h-8 w-14 items-center justify-center rounded-[11px]", on && "bg-sky")}>
                <Icon className="size-[22px]" strokeWidth={on ? 2.2 : 1.8} />
              </span>
              <span className={cn("text-[12px]", on ? "font-extrabold" : "font-semibold")}>{label}</span>
              {badge ? (
                <span className="absolute -top-0.5 right-[calc(50%-32px)] rounded-[7px] bg-cobalt px-1.5 py-px text-[11px] font-extrabold text-white">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
