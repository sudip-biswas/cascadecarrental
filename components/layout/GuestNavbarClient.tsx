"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bell, Heart, Search } from "lucide-react";
import { cn, formatRange, zonedInstant } from "@/lib/utils";

/** The search pill in the nav. Shows the current search when there is one. */
export function NavSearch() {
  const pathname = usePathname();
  const params = useSearchParams();
  if (pathname === "/") return <div className="hidden flex-[1_1_280px] md:block" />;

  const where = params.get("where");
  const from = params.get("from");
  const until = params.get("until");
  const when = from && until ? formatRange(zonedInstant(from), zonedInstant(until)) : null;
  const label = [where, when].filter(Boolean).join(" · ") || "Search cars";

  const query = new URLSearchParams();
  for (const key of ["where", "from", "until"]) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  const qs = query.toString();

  return (
    <Link
      href={qs ? `/search?${qs}` : "/search"}
      className="hidden max-w-[520px] flex-[1_1_280px] items-center gap-2.5 rounded-[14px] bg-board px-3.5 py-2.5 text-[15px] font-semibold transition-colors hover:bg-line md:flex"
    >
      <Search className="size-[18px] shrink-0" strokeWidth={2} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

const linkClass =
  "flex items-center gap-1.5 rounded-[12px] px-3.5 py-[11px] text-[15px] font-semibold transition-colors hover:bg-board";

interface Account {
  initial: string;
  unread: number;
  notices: number;
}

const iconLinkClass =
  "relative flex size-[42px] items-center justify-center rounded-[12px] transition-colors hover:bg-board";

export function NavLinks({ account }: { account: Account | null }) {
  const pathname = usePathname();
  const isActive = (prefix: string) => pathname.startsWith(prefix);

  if (!account) {
    return (
      <nav className="ml-auto flex items-center gap-1">
        <Link href="/host/vehicles/new" className={cn(linkClass, "hidden md:flex")}>
          List your car
        </Link>
        <Link href="/login" className={linkClass}>
          Sign in
        </Link>
        <Link
          href="/register"
          className="hidden rounded-[12px] bg-ink px-[18px] py-3 text-[15px] font-bold text-white transition-colors hover:bg-graphite sm:block"
        >
          Sign up
        </Link>
      </nav>
    );
  }

  return (
    <nav className="ml-auto flex items-center gap-1">
      <Link
        href="/trips"
        aria-current={isActive("/trips") ? "page" : undefined}
        className={cn(linkClass, "hidden md:flex", isActive("/trips") && "bg-sky hover:bg-sky")}
      >
        Trips
      </Link>
      <Link
        href="/favorites"
        aria-label="Favorites"
        aria-current={isActive("/favorites") ? "page" : undefined}
        className={cn(
          linkClass,
          "px-[11px] lg:px-3.5",
          isActive("/favorites") && "bg-sky hover:bg-sky"
        )}
      >
        <Heart className="size-5" strokeWidth={1.9} />
        <span className="hidden lg:inline">Favorites</span>
      </Link>
      <Link
        href="/messages"
        aria-current={isActive("/messages") ? "page" : undefined}
        className={cn(linkClass, "hidden md:flex", isActive("/messages") && "bg-sky hover:bg-sky")}
      >
        Inbox
        {account.unread > 0 && (
          <span className="rounded-[7px] bg-cobalt px-1.5 py-px text-[12px] font-extrabold text-white">
            {account.unread}
          </span>
        )}
      </Link>
      <Link
        href="/notifications"
        aria-label={account.notices > 0 ? `Notifications, ${account.notices} new` : "Notifications"}
        aria-current={isActive("/notifications") ? "page" : undefined}
        className={cn(iconLinkClass, isActive("/notifications") && "bg-sky hover:bg-sky")}
      >
        <Bell className="size-5" strokeWidth={1.9} />
        {account.notices > 0 && (
          <span className="absolute -top-0.5 -right-0.5 rounded-[7px] bg-cobalt px-1.5 py-px text-[11px] font-extrabold text-white">
            {account.notices > 99 ? "99+" : account.notices}
          </span>
        )}
      </Link>
      <Link href="/host" className={cn(linkClass, "bg-board hover:bg-line")}>
        Host
      </Link>
      <Link
        href="/profile"
        aria-label="Your profile"
        className="ml-1 hidden size-[42px] items-center justify-center rounded-[13px] bg-peach font-display text-[18px] font-extrabold md:flex"
      >
        {account.initial}
      </Link>
    </nav>
  );
}
