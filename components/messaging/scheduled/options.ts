import type { MessageTemplate } from "@/lib/supabase/types";

// Template options and wording, safe to use in the browser. The scheduling
// itself is in lib/scheduled-messages.ts.

export type TemplateEvent = MessageTemplate["event"];
export type TripType = MessageTemplate["trip_type"];

export const EVENTS: { value: TemplateEvent; label: string }[] = [
  { value: "booked", label: "Trip booked" },
  { value: "trip_start", label: "Trip start" },
  { value: "three_quarters", label: "Trip 3/4 time" },
  { value: "trip_end", label: "Trip finish" },
];

/** The delays a host can pick, in minutes. 0 is "immediately". */
export const OFFSETS = [0, 5, 15, 30, 45, 60, 120, 180, 240, 300, 720, 1440, 2880, 4320, 5760, 7200];

export const TRIP_TYPES: { value: TripType; label: string }[] = [
  { value: "all", label: "All trips" },
  { value: "any_delivery", label: "Any delivery" },
  { value: "no_delivery", label: "No delivery" },
  { value: "custom_delivery", label: "Delivery to an address only" },
  { value: "airport_delivery", label: "Airport delivery only" },
];

/** What a host can type after @. Filled in from the trip when the message goes out. */
export const VARIABLES: { token: string; label: string; sample: string }[] = [
  { token: "GuestName", label: "Guest's first name", sample: "Kayla" },
  { token: "CarName", label: "Car", sample: "Toyota Prius c" },
  { token: "LicensePlate", label: "License plate", sample: "CLX5914" },
  { token: "TripStartDate", label: "Trip start date", sample: "Fri Nov 21" },
  { token: "TripStartTime", label: "Trip start time", sample: "10:00" },
  { token: "TripEndDate", label: "Trip end date", sample: "Mon Nov 24" },
  { token: "TripEndTime", label: "Trip end time", sample: "10:00" },
  { token: "PickupLocation", label: "Pick-up area", sample: "SeaTac" },
  { token: "PickupAddress", label: "Pick-up address", sample: "18740 International Blvd, SeaTac" },
  { token: "HostName", label: "Your first name", sample: "Sam" },
  { token: "TripLink", label: "Link to the trip", sample: "cascadecarrental.com/trips/…" },
];

const TOKEN = /@([A-Za-z]+)/g;

/** Swaps each @Variable for its value. Anything it doesn't know is left as typed. */
export function fillVariables(body: string, values: Record<string, string>): string {
  return body.replace(TOKEN, (whole, name: string) => values[name] ?? whole);
}

/** The message as a guest would see it, with made-up trip details. */
export function previewMessage(body: string): string {
  return fillVariables(body, Object.fromEntries(VARIABLES.map((v) => [v.token, v.sample])));
}

export function formatOffset(minutes: number): string {
  if (minutes === 0) return "Immediately";
  if (minutes < 60) return `${minutes} minutes`;
  if (minutes < 1440) return minutes === 60 ? "1 hour" : `${minutes / 60} hours`;
  return minutes === 1440 ? "1 day" : `${minutes / 1440} days`;
}

/** "5 minutes after trip booked", "Immediately after trip 3/4 time". */
export function describeSchedule(t: Pick<MessageTemplate, "event" | "offset_minutes" | "direction">): string {
  const event = EVENTS.find((e) => e.value === t.event)?.label.toLowerCase() ?? t.event;
  return `${formatOffset(t.offset_minutes)} ${t.direction} ${event}`;
}

/** Ready-made messages a host can start from. */
export const EXAMPLES: { name: string; body: string }[] = [
  {
    name: "Thanks for booking",
    body: "Hi @GuestName, thanks for booking my @CarName! Pick-up is @TripStartDate at @TripStartTime at @PickupAddress. Message me here if anything comes up. @HostName",
  },
  {
    name: "Day before pick-up",
    body: "Hi @GuestName, see you tomorrow at @TripStartTime. The @CarName (plate @LicensePlate) will be at @PickupAddress. Your trip details: @TripLink",
  },
  {
    name: "Return reminder",
    body: "Hi @GuestName, a quick reminder that the @CarName is due back @TripEndDate at @TripEndTime. Please return it with the same fuel level, and take a few photos at drop-off.",
  },
];
