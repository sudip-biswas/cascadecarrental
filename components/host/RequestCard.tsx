import Link from "next/link";
import { Check, Clock, MessageSquare } from "lucide-react";
import { Fact, Tag } from "@/components/kit";
import { TripActionButtons } from "@/components/trips/TripActionButtons";
import { hostEarningsCents, tripDays } from "@/lib/pricing";
import { formatCurrency, formatDate, formatDay } from "@/lib/utils";
import { answerBy, PROTECTION_LABEL, timeLeft, type ConversationLink, type HostTrip } from "./data";
import { firstName, Initial } from "./bits";

function inboxHref(conversation: ConversationLink | null) {
  return conversation ? `/host/inbox/${conversation.id}` : "/host/inbox";
}

/** A booking request on Today: who, when, what the host gets, and the answer buttons. */
export function RequestCompact({ trip, conversation }: { trip: HostTrip; conversation: ConversationLink | null }) {
  const guest = firstName(trip.guest?.full_name);
  const car = trip.vehicle ? trip.vehicle.model : "your car";

  return (
    <div className="flex flex-col gap-3.5 rounded-[22px] bg-white p-3.5">
      <div className="flex items-center gap-3">
        <Initial name={guest} seed={trip.guest_id} />
        <div className="min-w-0 flex-1">
          <p className="text-[18px] leading-snug font-extrabold">
            {guest} wants the {car}
          </p>
          <p className="text-sm text-slate">
            {formatDay(trip.starts_at)} – {formatDay(trip.ends_at)}
            {trip.guest?.driving_license_verified ? " · licence verified" : ""}
          </p>
        </div>
        <div className="figures shrink-0 text-right">
          <p className="font-display text-[24px] leading-none font-extrabold">
            {formatCurrency(hostEarningsCents(trip.subtotal_cents))}
          </p>
          <p className="mt-1.5 text-[13px] text-slate">to you</p>
        </div>
      </div>
      {conversation?.lastGuestMessage && (
        <p className="rounded-[14px] bg-board px-3 py-2.5 text-[15px]">&ldquo;{conversation.lastGuestMessage}&rdquo;</p>
      )}
      <TripActionButtons tripId={trip.id} guestName={guest}>
        <Link
          href={inboxHref(conversation)}
          aria-label={`Message ${guest}`}
          className="flex size-[50px] items-center justify-center rounded-[14px] bg-board transition-colors hover:bg-line"
        >
          <MessageSquare className="size-5" strokeWidth={1.75} />
        </Link>
      </TripActionButtons>
    </div>
  );
}

/** The full request on the Trips page, with what's known about the guest. */
export function RequestFull({ trip, conversation }: { trip: HostTrip; conversation: ConversationLink | null }) {
  const guest = firstName(trip.guest?.full_name);
  const car = trip.vehicle ? trip.vehicle.model : "your car";
  const checks = [
    trip.guest?.identity_verified && "ID confirmed",
    trip.guest?.driving_license_verified && "Driver's licence verified",
    `Card held for ${formatCurrency(trip.total_cents)}`,
  ].filter((c): c is string => Boolean(c));

  return (
    <section className="flex flex-wrap gap-5 rounded-[32px] bg-white p-3.5">
      <div className="flex max-w-full flex-[1_1_280px] flex-col gap-3.5 rounded-[24px] bg-butter p-5 text-butter-ink sm:max-w-[380px]">
        <div className="flex items-center gap-3">
          <Initial name={guest} tone="white" className="size-16 rounded-[20px] text-[28px]" />
          <div>
            <p className="font-display text-[28px] leading-none font-extrabold text-ink">{guest}</p>
            {trip.guest?.created_at && (
              <p className="mt-1.5 text-sm">
                Joined {formatDate(trip.guest.created_at, { day: undefined })}
              </p>
            )}
          </div>
        </div>
        <ul className="flex flex-col gap-2 text-[15px] text-ink">
          {checks.map((c) => (
            <li key={c} className="flex items-center gap-2">
              <Check className="size-4 shrink-0" strokeWidth={2.5} />
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex min-w-0 flex-[999_1_380px] flex-col gap-3.5 p-1.5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-[clamp(28px,3.4vw,40px)] leading-[1.12] tracking-[-0.03em]">
            Wants the {car},<br />
            {formatDay(trip.starts_at)} – {formatDay(trip.ends_at)}
          </h2>
          <Tag tone="butter" className="text-sm">
            <Clock className="size-3.5" strokeWidth={2.5} />
            {timeLeft(answerBy(trip))}
          </Tag>
        </div>
        {conversation?.lastGuestMessage && (
          <p className="rounded-[16px] bg-board px-3.5 py-3 text-base leading-[1.45]">
            &ldquo;{conversation.lastGuestMessage}&rdquo;
          </p>
        )}
        <div className="figures grid grid-cols-3 gap-2">
          <Fact label="Days" value={tripDays(trip.starts_at, trip.ends_at)} className="rounded-[16px] p-3" />
          <Fact
            label="Protection"
            value={trip.protection_plan ? PROTECTION_LABEL[trip.protection_plan] : "None"}
            className="rounded-[16px] p-3"
          />
          <Fact
            label="You get"
            value={formatCurrency(hostEarningsCents(trip.subtotal_cents))}
            tone="peach"
            className="rounded-[16px] p-3"
          />
        </div>
        <TripActionButtons tripId={trip.id} guestName={guest} className="mt-auto [&>button]:flex-none [&>button]:px-6">
          <Link
            href={inboxHref(conversation)}
            className="flex h-[50px] items-center rounded-[14px] bg-board px-5 text-base font-bold transition-colors hover:bg-line"
          >
            Message {guest}
          </Link>
        </TripActionButtons>
      </div>
    </section>
  );
}
