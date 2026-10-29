import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Tag } from "@/components/kit";
import { hostEarningsCents } from "@/lib/pricing";
import { tripStatus } from "@/lib/trip-status";
import { cn, formatCurrency, formatDay, formatRange, formatTime } from "@/lib/utils";
import type { ThreadTrip } from "./inbox";
import type { PanelFrom } from "./InboxShell";
import { PanelToggle } from "./PanelToggle";
import { RequestActions } from "./RequestActions";

interface Props {
  otherName: string;
  trip: ThreadTrip | null;
  viewer: "guest" | "host";
  backHref: string;
  /** The trip panel, folded under the top bar on phones. */
  panel?: ReactNode;
  /** From this width the panel sits beside the thread, so the trip strip here hides. */
  panelBeside?: PanelFrom;
}

// Ranges rather than an override, so the two display classes never compete.
const SHOW_UNTIL: Record<PanelFrom, string> = { xl: "md:max-xl:flex", wide: "md:max-[1439px]:flex" };

export function ThreadHeader({ otherName, trip, viewer, backHref, panel, panelBeside }: Props) {
  const showWide = panelBeside ? SHOW_UNTIL[panelBeside] : "md:flex";
  const status = trip ? tripStatus(trip, viewer) : null;
  const tripHref = trip ? (viewer === "guest" ? `/trips/${trip.id}` : "/host/trips") : null;
  const car = trip?.vehicle ? `${trip.vehicle.make} ${trip.vehicle.model}` : "the car";
  const isRequest = viewer === "host" && trip?.status === "pending" && trip.payment_status === "authorized";

  return (
    <div className="flex flex-col">
      {/* Phones: compact bar with a way back to the list. */}
      <div className="flex items-center gap-2.5 p-3 md:hidden">
        <Link
          href={backHref}
          aria-label="Back to inbox"
          className="flex size-11 flex-none items-center justify-center rounded-[14px] bg-board"
        >
          <ChevronLeft className="size-5" strokeWidth={2} />
        </Link>
        <span
          aria-hidden
          className="flex size-[42px] flex-none items-center justify-center rounded-[13px] bg-mint font-display text-[18px] font-extrabold"
        >
          {otherName[0]?.toUpperCase() ?? "?"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[17px] font-extrabold">{otherName}</span>
          {trip && (
            <span className="truncate text-[13px] text-slate">
              {trip.vehicle?.model ?? "Trip"} · {formatRange(trip.starts_at, trip.ends_at)}
            </span>
          )}
        </span>
        {status && tripHref && (
          <Link href={tripHref}>
            <Tag tone={status.tone}>{status.label}</Tag>
          </Link>
        )}
      </div>
      {panel && <PanelToggle label={trip ? "Trip details" : "About"}>{panel}</PanelToggle>}

      {/* Wider screens: the trip this conversation is about. */}
      {trip && tripHref ? (
        <Link
          href={tripHref}
          className={cn("m-3 hidden items-center gap-3 rounded-[18px] bg-board p-2.5 transition-colors hover:bg-line", showWide)}
        >
          {trip.vehicle?.photo ? (
            <Image
              src={trip.vehicle.photo}
              alt=""
              width={64}
              height={50}
              className="h-[50px] w-16 flex-none rounded-[12px] object-cover"
            />
          ) : (
            <span className="h-[50px] w-16 flex-none rounded-[12px] bg-line" />
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-base font-extrabold">
              {car} · {formatDay(trip.starts_at)} – {formatDay(trip.ends_at)}
            </span>
            <span className="truncate text-sm text-slate">
              Pick-up in {trip.pickup_location} at {formatTime(trip.starts_at)}
            </span>
          </span>
          {status && <Tag tone={status.tone}>{status.label}</Tag>}
        </Link>
      ) : (
        <div className="m-3 hidden items-center gap-3 md:flex">
          <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-[14px] bg-mint font-display text-[18px] font-extrabold"
          >
            {otherName[0]?.toUpperCase() ?? "?"}
          </span>
          <span className="text-lg font-extrabold">{otherName}</span>
        </div>
      )}

      {isRequest && trip && (
        <div className="mx-3 mb-2 flex flex-wrap items-center gap-3 rounded-[20px] bg-butter p-3.5 md:mt-0">
          <span className="flex-[1_1_220px]">
            <span className="block text-[17px] font-extrabold">
              {otherName} wants the {trip.vehicle?.model ?? "car"}, {formatRange(trip.starts_at, trip.ends_at)}
            </span>
            <span className="text-sm text-butter-ink">
              {formatCurrency(hostEarningsCents(trip.subtotal_cents))} to you · answer before pick-up
            </span>
          </span>
          <RequestActions tripId={trip.id} />
        </div>
      )}
    </div>
  );
}
