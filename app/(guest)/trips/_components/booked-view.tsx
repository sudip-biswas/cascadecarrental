import Link from "next/link";
import { Check, MessageSquare } from "lucide-react";
import { Container, Tile, TileTitle } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { tripDays } from "@/lib/pricing";
import { cn, formatCurrency, formatDateTime, formatRange, pluralize } from "@/lib/utils";
import { type TripRow, carName, hostFirstName, paidLabel } from "../_lib/trip-row";
import { CarSummary, calendarUrl } from "./parts";
import { AutoRefresh } from "./auto-refresh";

interface Stage {
  when: string;
  title: string;
  detail: string;
  /** done, in progress (striped) or still to come */
  state: "done" | "now" | "later";
}

/** Shown right after checkout: request sent, or booked. */
export function BookedView({ trip }: { trip: TripRow }) {
  const host = hostFirstName(trip);
  const total = formatCurrency(trip.total_cents);
  const confirming = trip.status === "pending" && trip.payment_status === "pending";
  const requested = trip.status === "pending" && trip.payment_status === "authorized";
  const miles = (trip.vehicle?.distance_included_mi ?? trip.distance_included_mi) * tripDays(trip.starts_at, trip.ends_at);

  const title = confirming
    ? "Confirming your payment."
    : requested
      ? `Request sent to ${host}.`
      : "You're booked.";
  const lead = confirming
    ? "This takes a few seconds. The page updates on its own."
    : requested
      ? `${host} has until pick-up to say yes. Your card is held, not charged, until then.`
      : `${carName(trip)} is yours from ${formatDateTime(trip.starts_at)}.`;

  const stages: Stage[] = [
    {
      when: "Now",
      title: requested || confirming ? "Requested" : "Booked",
      detail: `${total} ${requested ? "held on your card" : confirming ? "being confirmed" : "paid"}`,
      state: "done",
    },
    ...(requested
      ? [{ when: "Before pick-up", title: `${host} answers`, detail: "Yes charges the card. No releases it.", state: "now" as const }]
      : []),
    {
      when: formatDateTime(trip.starts_at),
      title: "Keys",
      detail: requested ? `Exact spot shows here once ${host} says yes.` : (trip.vehicle?.location_address ?? trip.pickup_location),
      state: "later",
    },
    {
      when: formatDateTime(trip.ends_at),
      title: "Back",
      detail: `Same spot. ${pluralize(miles, "mile")} included.`,
      state: "later",
    },
  ];

  const protection = trip.protection_plan ? `${trip.protection_plan[0].toUpperCase()}${trip.protection_plan.slice(1)} protection` : "No protection";
  const rate = trip.rate_type === "non_refundable" ? "pay now" : "free cancellation";

  return (
    <>
      {confirming && <AutoRefresh />}
      <section className="bg-mint py-12 text-mint-ink sm:pt-14 sm:pb-16">
        <Container className="flex flex-wrap items-end justify-between gap-8">
          <div className="flex flex-[999_1_520px] flex-col gap-[18px]">
            <span className="flex size-[72px] items-center justify-center rounded-[22px] bg-ink text-white">
              <Check className="size-9" strokeWidth={2.5} />
            </span>
            <h1 className="headline text-[clamp(48px,7vw,112px)] leading-[0.98] text-ink">{title}</h1>
            <p className="max-w-[560px] text-[19px] leading-[1.45]">{lead}</p>
          </div>
          <div className="flex flex-[1_1_320px] flex-wrap gap-2.5">
            <Button asChild size="lg">
              <Link href={`/messages/new?trip=${trip.id}`}>
                <MessageSquare />
                Message {host}
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/trips/${trip.id}`}>See the trip</Link>
            </Button>
          </div>
        </Container>
      </section>

      <Container className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4 py-6">
        <Tile className="col-span-full flex flex-col gap-5 sm:p-[26px]">
          <TileTitle>What happens next</TileTitle>
          <ol className="grid grid-cols-1 gap-5 sm:grid-cols-[repeat(auto-fit,minmax(0,1fr))] sm:gap-2.5">
            {stages.map((s) => (
              <li key={s.title} className="flex flex-col gap-2.5">
                <span
                  className={cn(
                    "h-2 rounded-[4px]",
                    s.state === "done" && "bg-ink",
                    s.state === "now" && "bg-[repeating-linear-gradient(90deg,#111_0_10px,#e9ebef_10px_18px)]",
                    s.state === "later" && "bg-line"
                  )}
                />
                <span className="text-[13px] font-bold text-slate">{s.when}</span>
                <span className="font-display text-[22px] font-extrabold">{s.title}</span>
                <span className="text-[15px] text-slate">{s.detail}</span>
              </li>
            ))}
          </ol>
        </Tile>

        <CarSummary
          trip={trip}
          detail={
            <>
              {formatRange(trip.starts_at, trip.ends_at)} · {protection} · {rate}
              <span className="figures mt-1 block text-[20px] font-extrabold text-ink">
                {formatCurrency(trip.total_cents)}{" "}
                <span className="text-sm font-semibold text-slate">{paidLabel(trip).toLowerCase()}</span>
              </span>
            </>
          }
        />

        <Tile tone="butter" className="flex flex-col gap-3 sm:p-6">
          <TileTitle className="text-[24px]">Before you go</TileTitle>
          <Todo href={calendarUrl(trip)} external>
            Add the trip to your calendar
          </Todo>
          <Todo href={`/messages/new?trip=${trip.id}`}>Tell {host} when you&apos;ll arrive</Todo>
        </Tile>
      </Container>
    </>
  );
}

function Todo({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-base">
      <span className="size-6 shrink-0 rounded-[8px] bg-white" />
      {external ? (
        <a href={href} target="_blank" rel="noreferrer" className="font-bold hover:text-cobalt">
          {children}
        </a>
      ) : (
        <Link href={href} className="font-bold hover:text-cobalt">
          {children}
        </Link>
      )}
    </div>
  );
}
