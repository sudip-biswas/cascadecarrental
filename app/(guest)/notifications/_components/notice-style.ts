import {
  Ban,
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CarFront,
  CircleCheck,
  CreditCard,
  RotateCcw,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/components/kit";
import type { Notification } from "@/lib/supabase/types";
import { formatDateShort } from "@/lib/utils";

/** Icon and fill for a notification, from its kind (a TripEvent for trip notices). */
export function noticeStyle(kind: string): { icon: LucideIcon; tone: Tone } {
  switch (kind) {
    case "requested":
    case "change_requested":
      return { icon: CalendarClock, tone: "butter" };
    case "booked":
    case "accepted":
    case "change_accepted":
      return { icon: CalendarCheck, tone: "mint" };
    case "declined":
    case "expired":
    case "change_declined":
      return { icon: CalendarX, tone: "board" };
    case "cancelled_by_guest":
    case "cancelled_by_host":
    case "cancelled_by_cascade":
      return { icon: Ban, tone: "peach" };
    case "pickup_soon":
      return { icon: CarFront, tone: "sky" };
    case "return_soon":
      return { icon: RotateCcw, tone: "lilac" };
    case "completed":
      return { icon: CircleCheck, tone: "mint" };
    case "charge_requested":
    case "charge_paid":
    case "charge_disputed":
    case "charge_failed":
      return { icon: CreditCard, tone: "peach" };
    case "deposit_held":
    case "deposit_released":
      return { icon: ShieldCheck, tone: "sky" };
    default:
      return { icon: Bell, tone: "board" };
  }
}

/** Read this recently still shows as new, so marking it read on view doesn't flicker. */
const NEW_FOR_MS = 5 * 60 * 1000;

export function isNew(notice: Pick<Notification, "read_at">, now = Date.now()) {
  return !notice.read_at || now - new Date(notice.read_at).getTime() < NEW_FOR_MS;
}

/** "Just now", "2h ago", or the date. */
export function noticeTime(createdAt: string, now = Date.now()) {
  const minutes = Math.round((now - new Date(createdAt).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)}h ago`;
  return formatDateShort(createdAt);
}
