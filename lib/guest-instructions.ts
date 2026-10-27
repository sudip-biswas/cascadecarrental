import type { GuestInstructions } from "@/lib/supabase/types";

export type CheckInMethod = GuestInstructions["check_in_method"];
export type Faq = GuestInstructions["faqs"][number];

export const LIMITS = { pickup: 5000, welcome: 170, guide: 5000, question: 200, answer: 1000, faqs: 20 } as const;

/** How the guest gets the keys, with the line they see on their trip. */
export const CHECK_IN: Record<CheckInMethod, { label: string; hint: string; guestLine: string }> = {
  in_person: {
    label: "In person",
    hint: "You or a co-host hand over the keys.",
    guestLine: "You'll meet your host to get the keys.",
  },
  lockbox: {
    label: "Lockbox",
    hint: "Keys wait in a lockbox. Put the code in your pick-up notes.",
    guestLine: "You'll check yourself in with a lockbox.",
  },
  keyless: {
    label: "Keyless",
    hint: "The car opens with a keypad code or an app.",
    guestLine: "You'll unlock the car yourself, no keys to collect.",
  },
};

/** Booked trips are the only ones that ever see the instructions. */
export const BOOKED_STATUSES = ["approved", "active", "completed"] as const;

export function isBooked(status: string): boolean {
  return (BOOKED_STATUSES as readonly string[]).includes(status);
}

/** Whether there's anything worth showing a guest beyond the check-in line. */
export function hasContent(i: Pick<GuestInstructions, "pickup_instructions" | "car_guide" | "faqs" | "welcome_message">) {
  return !!(i.pickup_instructions?.trim() || i.car_guide?.trim() || i.welcome_message?.trim() || i.faqs.length);
}

/** The welcome note shows from an hour before pick-up until the car is back. */
export function welcomeOpen(trip: { status: string; starts_at: string }, now = new Date()): boolean {
  if (trip.status === "active") return true;
  return trip.status === "approved" && now.getTime() >= new Date(trip.starts_at).getTime() - 60 * 60 * 1000;
}
