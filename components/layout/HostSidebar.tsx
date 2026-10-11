"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  Car,
  MessageCircle,
  Bell,
  BarChart3,
  Star,
  TrendingUp,
  ChevronDown,
  MapPin,
  Clock,
  Receipt,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface NavItem {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavSection {
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
  items?: NavItem[];
}

interface Props {
  unreadMessages?: number;
  unreadNotifications?: number;
}

export function HostSidebar({ unreadMessages = 0, unreadNotifications = 0 }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  function NavLink({ href, label, icon: Icon, badge }: NavItem) {
    return (
      <Link
        href={href}
        className={cn(
          "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
          isActive(href)
            ? "bg-cascade-100 text-cascade-700 font-semibold"
            : "text-muted-foreground hover:bg-muted hover:text-cascade-900"
        )}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4" />}
          {label}
        </div>
        {badge != null && badge > 0 && (
          <span className="bg-ember-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
            {badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <aside className="w-60 shrink-0 h-full border-r border-border bg-white overflow-y-auto">
      <div className="p-4 space-y-1">
        {/* Calendar */}
        <NavLink href="/host/calendar" label="Calendar" icon={Calendar} />

        {/* Trips */}
        <Accordion type="single" collapsible defaultValue="trips">
          <AccordionItem value="trips" className="border-0">
            <AccordionTrigger className="px-3 py-2 text-sm font-medium text-cascade-900 hover:no-underline [&[data-state=open]>svg]:rotate-180 rounded-lg hover:bg-muted">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                Trips
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0 pl-4 space-y-0.5">
              <NavLink href="/host/trips" label="Booked" />
              <NavLink href="/host/trips/history" label="History" icon={History} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Inbox */}
        <Accordion type="single" collapsible defaultValue="inbox">
          <AccordionItem value="inbox" className="border-0">
            <AccordionTrigger className="px-3 py-2 text-sm font-medium text-cascade-900 hover:no-underline rounded-lg hover:bg-muted">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Inbox
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0 pl-4 space-y-0.5">
              <NavLink
                href="/host/inbox"
                label="Messages"
                badge={unreadMessages}
              />
              <NavLink
                href="/host/notifications"
                label="Notifications"
                badge={unreadNotifications}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Vehicles */}
        <Accordion type="single" collapsible defaultValue="vehicles">
          <AccordionItem value="vehicles" className="border-0">
            <AccordionTrigger className="px-3 py-2 text-sm font-medium text-cascade-900 hover:no-underline rounded-lg hover:bg-muted">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4" />
                Vehicles
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0 pl-4 space-y-0.5">
              <NavLink href="/host/vehicles" label="Listings" />
              <NavLink href="/host/locations" label="Locations" />
              <NavLink href="/host/hours" label="Hours" />
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Business */}
        <Accordion type="single" collapsible defaultValue="business">
          <AccordionItem value="business" className="border-0">
            <AccordionTrigger className="px-3 py-2 text-sm font-medium text-cascade-900 hover:no-underline rounded-lg hover:bg-muted">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Business
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-0 pl-4 space-y-0.5">
              <NavLink href="/host/business/earnings" label="Earnings" />
              <NavLink href="/host/business/performance" label="Performance" />
              <NavLink href="/host/business/ratings" label="Ratings & reviews" />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </aside>
  );
}
