import type { SearchFilters } from "@/components/search/params";

export interface Faq {
  q: string;
  a: string;
}

/** A page for one way people search for a rental, e.g. "suv rental seattle". */
export interface RentalPage {
  slug: string;
  /** Short name for links and breadcrumbs. */
  label: string;
  h1: string;
  title: string;
  description: string;
  intro: string[];
  filters: Partial<Pick<SearchFilters, "types" | "fuels" | "nearSea" | "weekDiscount">>;
  /** The same cars on the search page, where guests can add dates. */
  search: Record<string, string>;
  faq: Faq[];
}

export const CITY = "Seattle";

export const RENTAL_PAGES: RentalPage[] = [
  {
    slug: "suv-rental",
    label: "SUVs",
    h1: "SUV rental in Seattle",
    title: "SUV rental in Seattle from local hosts",
    description:
      "Rent an SUV from a Seattle host for Rainier, the passes or a family trip. Full price with tax up front, miles included every day, pick up from the host.",
    intro: [
      "An SUV is the easy pick for Mount Rainier, the Cascade passes, the Olympic Peninsula or a car full of family and bags. Every SUV here belongs to a host around Seattle, and you collect it from them in person.",
      "The price on each car includes tax. Each listing says how many miles a day are included and what extra miles cost, so you know the total before you book.",
    ],
    filters: { types: ["suv"] },
    search: { type: "suv" },
    faq: [
      {
        q: "Do I need chains or traction tires to cross the passes?",
        a: "In winter, WSDOT can require traction tires or chains on Snoqualmie and Stevens passes, sometimes even for all-wheel drive. Check the WSDOT pass report before you leave and ask the host what the car carries.",
      },
      {
        q: "Can I take an SUV to Mount Rainier?",
        a: "Yes. Plan the miles: Paradise is roughly 110 miles each way from Seattle. Each car shows the miles included per day, and they add up across your trip.",
      },
      {
        q: "Is a week-long SUV rental cheaper?",
        a: "Often. Many hosts set a weekly discount for trips of 7 days or more and a monthly one for 30 days or more, and it's applied automatically at checkout.",
      },
    ],
  },
  {
    slug: "airport-car-rental",
    label: "Near SEA",
    h1: "Car rental near Sea-Tac Airport",
    title: "Car rental near Sea-Tac Airport (SEA)",
    description:
      "Rent a car parked near Seattle-Tacoma International Airport from a local host. No rental counter, full price with tax up front, pick up at 10:00.",
    intro: [
      "There's no rental counter and no shuttle line. We meet you at the car — at our meeting point right by Sea-Tac, or delivered to the airport parking garage, your choice. Check it over together, take the keys, and drive off. Just send us your flight details and we'll have it ready when you land.",
      "Pick-up and return are at 10:00 on the dates you choose, so pick dates that suit your flights. The exact address shows on your trip once it's confirmed.",
    ],
    filters: { nearSea: true },
    search: { near: "sea" },
    faq: [
      {
        q: "Will the host meet me at the terminal?",
        a: "Handover is wherever the host keeps the car. The exact address shows on your trip once it's confirmed, and you can message the host before you book if you need something specific.",
      },
      {
        q: "What time do I pick up and return the car?",
        a: "Both are at 10:00 on the dates you book, at the same place.",
      },
      {
        q: "Is tax included in the price?",
        a: "Yes. The total you see before paying includes tax, and protection if you add it.",
      },
    ],
  },
  {
    slug: "monthly-car-rental",
    label: "Week or longer",
    h1: "Weekly and monthly car rental in Seattle",
    title: "Weekly and monthly car rental in Seattle",
    description:
      "Long-term car rental in Seattle from local hosts who discount trips of a week or a month. The discount is applied automatically at checkout.",
    intro: [
      "Staying a while, between cars, or waiting on a repair? These hosts discount trips of 7 days or more, and many go further for 30 days or more.",
      "The discount is worked out from your dates and shown before you pay. There's nothing to ask for and no code to enter.",
    ],
    filters: { weekDiscount: true },
    search: { discount: "week" },
    faq: [
      {
        q: "How do weekly and monthly discounts work?",
        a: "Each host sets their own. Book 7 days or more and the weekly discount applies; book 30 days or more and the monthly one applies instead, if the host sets one.",
      },
      {
        q: "Are miles included on a long rental?",
        a: "Yes. Each car includes a set number of miles per day, so a month-long trip includes 30 days' worth. Extra miles are charged at the rate on the listing.",
      },
      {
        q: "Can I cancel a long rental?",
        a: "On the flexible rate you can cancel for a full refund until pick-up. The pay-now rate is cheaper and free to cancel for 24 hours after the trip is confirmed.",
      },
    ],
  },
  {
    slug: "electric-car-rental",
    label: "Electric",
    h1: "Electric car rental in Seattle",
    title: "Electric and hybrid car rental in Seattle",
    description:
      "Rent an electric car or hybrid from a Seattle host. See the range, the full price with tax and the miles included before you book.",
    intro: [
      "Try an EV for a weekend or keep fuel costs down on a longer trip. Every electric car and hybrid here belongs to a host around Seattle.",
      "Electric listings show their range, and you return the car as charged as you got it.",
    ],
    filters: { fuels: ["electric", "hybrid"] },
    search: { fuel: "electric,hybrid" },
    faq: [
      {
        q: "How charged should I return an electric car?",
        a: "As charged as you got it. Check the battery level with the host at pick-up.",
      },
      {
        q: "How far can I go on a charge?",
        a: "Each electric listing shows the car's range. Ask the host if you're planning a long drive.",
      },
    ],
  },
  {
    slug: "truck-rental",
    label: "Trucks",
    h1: "Pickup truck rental in Seattle",
    title: "Pickup truck rental in Seattle from local hosts",
    description:
      "Rent a pickup truck from a Seattle host for moving day, a dump run or a weekend in the mountains. Full price with tax up front.",
    intro: [
      "Moving a couch, hauling to the dump or heading out with bikes and skis: a pickup does it. Every truck here belongs to a host around Seattle.",
      "Each listing shows the miles included per day, so short local jobs and longer trips are both easy to price.",
    ],
    filters: { types: ["truck"] },
    search: { type: "truck" },
    faq: [
      {
        q: "Can I use a rented truck for moving?",
        a: "Usually, yes. Message the host before you book if you're carrying anything heavy or bulky.",
      },
      {
        q: "Is tax included in the price?",
        a: "Yes. The total you see before paying includes tax.",
      },
    ],
  },
  {
    slug: "van-rental",
    label: "Vans",
    h1: "Van rental in Seattle",
    title: "Van and minivan rental in Seattle",
    description:
      "Rent a van or minivan from a Seattle host for a group trip, a band, or a car full of gear. Full price with tax up front.",
    intro: [
      "Room for the whole group, the band or a pile of camping gear. Every van here belongs to a host around Seattle.",
      "Listings show seats, miles included per day and the full price with tax.",
    ],
    filters: { types: ["van"] },
    search: { type: "van" },
    faq: [
      {
        q: "How many people fit in a rental van?",
        a: "Each listing shows its seat count. Filter by seats on the search page to see only vans that fit your group.",
      },
    ],
  },
];

export function rentalPage(slug: string) {
  return RENTAL_PAGES.find((p) => p.slug === slug) ?? null;
}

/** General questions, answered on the home page. */
export const RENTING_FAQ: Faq[] = [
  {
    q: "How does renting a car on Cascade work?",
    a: "Pick a car and your dates, then pay. All Cascade cars are instant book — your car is reserved the moment you confirm. We send pickup instructions right away and meet you at the car.",
  },
  {
    q: "Is tax included in the price?",
    a: "Yes. The total you see before paying includes tax, and protection if you add it.",
  },
  {
    q: "Can I cancel?",
    a: "On the flexible rate you can cancel for a full refund until pick-up. The pay-now rate is 9% cheaper and free to cancel for 24 hours after the trip is confirmed. If a host cancels, you always get a full refund.",
  },
  {
    q: "How many miles are included?",
    a: "Each car includes a set number of miles per day, shown on its page with the price of any extra miles.",
  },
  {
    q: "Are there discounts for longer trips?",
    a: "Many cars discount trips of 7 days or more, and 30 days or more. The discount is applied automatically at checkout.",
  },
  {
    q: "Where do I pick up the car?",
    a: "We meet you at the DoubleTree by Hilton Seattle Airport, 18740 International Blvd, SeaTac WA 98188. Text us when you land — we'll have your car waiting. Return to the same spot.",
  },
  {
    q: "Is Cascade a real rental company?",
    a: "Yes. Cascade Car Rental is operated by Cascade Fleet LLC, a Washington-licensed rental car company (WA rental car registration #R64728), based near Sea-Tac Airport. Call us at (650) 272-4085.",
  },
  {
    q: "What do I need to book?",
    a: "A valid driver's licence, age 21 or older (21–24 adds a $10/day young-driver fee for most vehicles), and a payment card. We'll ask for a licence photo after booking — it never delays your reservation.",
  },
  {
    q: "What does protection cover?",
    a: "Three tiers: Basic ($9.99/day, $3,000 max out-of-pocket), Standard ($16.99/day, $500 max), Complete ($24.99/day, $0). All are damage waivers from Cascade Fleet LLC, not third-party insurance. A $250 refundable hold is placed at pick-up — waived with Complete. Roadside assistance available at $2.99/day.",
  },
  {
    q: "Where exactly do I pick up at Sea-Tac?",
    a: "DoubleTree by Hilton Seattle Airport, 18740 International Blvd, SeaTac WA 98188. We meet you at the car — no rental counter. Text your flight number when you land and we'll be ready.",
  },
];

/** The rental page a car belongs on, for breadcrumbs. */
export function rentalPageFor(car: { vehicle_type: string; fuel_type: string }) {
  if (car.fuel_type === "electric" || car.fuel_type === "hybrid") return rentalPage("electric-car-rental");
  return RENTAL_PAGES.find((p) => p.filters.types?.includes(car.vehicle_type)) ?? null;
}
