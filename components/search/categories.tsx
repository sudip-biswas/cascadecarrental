import { CalendarRange, Mountain, PlaneLanding, Zap, type LucideIcon } from "lucide-react";
import type { Tone } from "@/components/kit";

/** The airport area, roughly ten miles around SEA. */
export const SEA_BOUNDS = { minLat: 47.305, maxLat: 47.595, minLng: -122.52, maxLng: -122.1 };

export interface TripCategory {
  key: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  tone: Tone;
  /** Its Seattle rental page, /seattle/[page]. */
  page: string;
}

export const TRIP_CATEGORIES: TripCategory[] = [
  {
    key: "airport",
    title: "Flying into SEA",
    blurb: "Cars parked near the airport",
    icon: PlaneLanding,
    tone: "mint",
    page: "airport-car-rental",
  },
  {
    key: "mountains",
    title: "Up to the mountains",
    blurb: "SUVs for Rainier and the passes",
    icon: Mountain,
    tone: "butter",
    page: "suv-rental",
  },
  {
    key: "week",
    title: "A week or longer",
    blurb: "Hosts who discount long trips",
    icon: CalendarRange,
    tone: "peach",
    page: "monthly-car-rental",
  },
  {
    key: "electric",
    title: "Electric",
    blurb: "EVs and hybrids",
    icon: Zap,
    tone: "lilac",
    page: "electric-car-rental",
  },
];

export const VEHICLE_TYPES = [
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "truck", label: "Truck" },
  { value: "van", label: "Van" },
  { value: "sports", label: "Sports" },
  { value: "luxury", label: "Luxury" },
  { value: "electric", label: "Electric" },
];

export const FUEL_TYPES = [
  { value: "gasoline", label: "Gas" },
  { value: "hybrid", label: "Hybrid" },
  { value: "electric", label: "Electric" },
  { value: "diesel", label: "Diesel" },
];

export function fuelLabel(fuel: string) {
  return FUEL_TYPES.find((f) => f.value === fuel)?.label ?? fuel;
}

export function typeLabel(type: string) {
  return VEHICLE_TYPES.find((t) => t.value === type)?.label ?? type;
}

export const TRANSMISSIONS = [
  { value: "automatic", label: "Automatic" },
  { value: "manual", label: "Manual" },
];

/** Features guests can filter on, as hosts list them in vehicle_features. */
export const FEATURES = [
  { value: "awd", label: "All-wheel drive" },
  { value: "android-auto", label: "Android Auto" },
  { value: "carplay", label: "Apple CarPlay" },
  { value: "backup-camera", label: "Backup camera" },
  { value: "bike-rack", label: "Bike rack" },
  { value: "blind-spot", label: "Blind spot warning" },
  { value: "bluetooth", label: "Bluetooth" },
  { value: "child-seat", label: "Child seat" },
  { value: "gps", label: "GPS" },
  { value: "heated-seats", label: "Heated seats" },
  { value: "keyless", label: "Keyless entry" },
  { value: "pet-friendly", label: "Pet friendly" },
  { value: "ski-rack", label: "Ski rack" },
  { value: "snow-tires", label: "Snow tires" },
  { value: "sunroof", label: "Sunroof" },
  { value: "toll-pass", label: "Toll pass" },
  { value: "usb", label: "USB charger" },
];

export function featureLabel(value: string) {
  return FEATURES.find((f) => f.value === value)?.label ?? null;
}
