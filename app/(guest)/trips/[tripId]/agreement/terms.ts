import { CHARGE_WINDOW_DAYS } from "@/lib/charges";
import { formatPrice } from "@/lib/utils";

export interface Term {
  title: string;
  body: string[];
}

interface TermsInput {
  host: string;
  minAge: number;
  electric: boolean;
  unlimitedMiles: boolean;
  includedMi: number;
  extraMileFeeCents: number;
}

/**
 * The rules every Cascade trip runs on, in plain words. Each one matches
 * something the app really does: a charge kind a host can send, the trip
 * page's messages, check-in photos. Cascade runs no roadside service, so the
 * terms send breakdowns to the host.
 */
export function agreementTerms(t: TermsInput): Term[] {
  return [
    {
      title: "Who can drive",
      body: [
        `Only the guest and added drivers named on this page, each ${t.minAge} or older with a valid licence they carry while driving.`,
        "Nobody else drives, even for a minute. Adding a driver goes through the trip page, and the host has to say yes.",
      ],
    },
    {
      title: "How the car can be used",
      body: [
        "Personal driving on public, paved roads.",
        "Not for paid rideshare or delivery work, towing, off-roading, racing or track days, or driving under the influence.",
        "Leaving Washington is fine. Driving into Canada needs the host's OK in the trip messages first.",
      ],
    },
    {
      title: "Smoking and pets",
      body: [
        "No smoking or vaping of anything in the car.",
        "Pets only when the host says yes in the trip messages. Smoke smell, ash or pet hair can be charged for the clean-up.",
      ],
    },
    {
      title: t.electric ? "Charge" : "Fuel",
      body: [
        `Bring the car back with as much ${t.electric ? "charge" : "fuel"} as it had at pick-up. What's missing can be charged.`,
      ],
    },
    {
      title: "Miles",
      body: [
        t.unlimitedMiles
          ? "Miles are unlimited on this trip."
          : `${t.includedMi.toLocaleString("en-US")} miles are included. Each mile over is ${t.extraMileFeeCents < 100 ? `${t.extraMileFeeCents}¢` : formatPrice(t.extraMileFeeCents)}, worked out from the odometer at check-in and check-out.`,
      ],
    },
    {
      title: "Tolls, tickets and towing",
      body: [
        "Tolls and bridge fees from the trip are passed on with the statement.",
        "Parking and traffic tickets, camera fines, towing and impound fees from the trip are the guest's. Pay them directly. One that reaches the host can be passed on or moved into the guest's name.",
      ],
    },
    {
      title: "Returning on time",
      body: [
        "Return the car at the time and place on this page. Need longer? Ask from the trip page before the trip ends.",
        "A late return without the host's OK can be charged, and so can the cost of a next trip it spoils.",
      ],
    },
    {
      title: "Check-in and check-out",
      body: [
        "At pick-up and at return, take photos of every side, the inside and the dashboard, and record the odometer and the fuel or charge on the trip page.",
        "Those photos and readings settle any question about damage, miles or fuel.",
      ],
    },
    {
      title: "Accidents, damage and breakdowns",
      body: [
        "Stop somewhere safe. If anyone is hurt or the car can't be driven, call 911, and get a police report for any crash.",
        `Take photos and tell ${t.host} in the trip messages straight away, within 24 hours at the latest. Don't have the car repaired yourself.`,
        `Cascade doesn't run a roadside service. For a flat, a dead battery or a breakdown, message ${t.host}, who arranges help.`,
      ],
    },
    {
      title: "Charges after the trip",
      body: [
        `Any charge comes within ${CHARGE_WINDOW_DAYS} days of the trip, with photos or receipts. The guest can pay it or dispute it, and Cascade looks at both sides.`,
        "Damage is the guest's to cover, through their protection plan if they took one, or their own insurance or their own pocket if not.",
      ],
    },
    {
      title: "If you're stopped",
      body: [
        "Show your licence and this page. The car is rented through Cascade from the host named here, for the dates shown.",
      ],
    },
  ];
}
