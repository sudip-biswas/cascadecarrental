/** A single guest review imported from Turo. */
export interface Review {
  name: string;
  /** Display string, e.g. "October 2026". */
  date: string;
  rating: number;
  text: string;
  source: "Turo";
}

/**
 * Reviews earned while hosting on Turo (3,324 trips completed).
 * Text is verbatim — do not edit, shorten, or paraphrase.
 */
export const REVIEWS: Review[] = [
  {
    name: "Sommer",
    date: "October 2026",
    rating: 5,
    text: "Easy from start to finish. The car was clean and owner responsive. As a heads up the radio doesn't work, but I didn't really find that bothersome. I was unfortunately involved in a pile up and I was super impressed with how quick both roadside and the owner were there to ensure I was taken care of. I'm very impressed overall despite having that happen during the trip.",
    source: "Turo",
  },
  {
    name: "Angeles",
    date: "October 2026",
    rating: 5,
    text: "The host was extremely accommodating. The vehicle was in great condition minus a few wear and tear items that is expected for a vehicle that is 10 years old. It was clean and reliable. I was up and down Seattle and only needed to add $20 of gas when I had to return it. This was a 10 out of 10 experience.",
    source: "Turo",
  },
  {
    name: "Sabrina",
    date: "October 2026",
    rating: 5,
    text: "Super responsive and flexible! Very professional. Car worked great and was as described, perfect for PNW weather. Would book again",
    source: "Turo",
  },
  {
    name: "Justin",
    date: "September 2026",
    rating: 5,
    text: "Car and pickup were super awesome and convenient! Could not have been happier with the car. No issues and Balaji was a great communicator.",
    source: "Turo",
  },
  {
    name: "Lindsay Marie",
    date: "October 2026",
    rating: 5,
    text: "Being an older car, it was in great shape and worked well for my needs. Car was easy to located and the communication was quick and directions were easy to follow.",
    source: "Turo",
  },
  {
    name: "Elijah",
    date: "October 2026",
    rating: 5,
    text: "Took a little trip out to Forks and along the coast, was amazing. The 4 runner was perfect for the job.",
    source: "Turo",
  },
  {
    name: "Tevon",
    date: "October 2026",
    rating: 5,
    text: "The car drove very nice and smoothly. I highly recommend renting this vehicle.",
    source: "Turo",
  },
  {
    name: "Jillian",
    date: "October 2026",
    rating: 5,
    text: "Clean, good condition, would rent again!",
    source: "Turo",
  },
  {
    name: "Angel",
    date: "October 2026",
    rating: 5,
    text: "Great car, and great host would book again!",
    source: "Turo",
  },
];
