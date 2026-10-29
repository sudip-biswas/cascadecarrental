"use client";

import Link from "next/link";
import { CalendarDays, Eye, MoreHorizontal, ShieldCheck, SlidersHorizontal, Tag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** The "…" menu on each car: jump straight to the settings hosts change most. */
export function ListingActions({
  vehicleId,
  name,
  previewHref,
  className,
}: {
  vehicleId: string;
  name: string;
  previewHref: string;
  className?: string;
}) {
  const manage = `/host/vehicles/${vehicleId}`;
  const items = [
    { href: `${manage}#trip-preferences`, label: "Trip preferences", icon: SlidersHorizontal },
    { href: `${manage}#pricing`, label: "Pricing & discounts", icon: Tag },
    { href: `${manage}#safety`, label: "Safety & inspections", icon: ShieldCheck },
    { href: `/host/calendar?car=${vehicleId}`, label: "Calendar", icon: CalendarDays },
    { href: previewHref, label: "Preview listing", icon: Eye },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`More for ${name}`}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-ink transition-colors outline-none hover:bg-board focus-visible:ring-2 focus-visible:ring-cobalt data-[state=open]:bg-board",
          className
        )}
      >
        <MoreHorizontal className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5">
        {items.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={label} asChild className="gap-2.5 rounded-[12px] px-3 py-2.5 text-[15px] font-semibold">
            <Link href={href}>
              <Icon className="size-[18px]" strokeWidth={1.75} />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
