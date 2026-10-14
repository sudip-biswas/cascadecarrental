import { redirect } from "next/navigation";
import Link from "next/link";
import { CarFront } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { settleTripStatuses } from "@/lib/trips";
import { hostEarningsCents, tripDays } from "@/lib/pricing";
import { tripStatus } from "@/lib/trip-status";
import { cn, formatCurrency, formatDateTime, formatRange, relativeDays } from "@/lib/utils";
import { PageTitle } from "@/components/kit";
import { RequestFull } from "@/components/host/RequestCard";
import { TripTabs, type TripView } from "@/components/host/TripTabs";
import { firstName } from "@/components/host/bits";
import {
  answerBy,
  isRequest,
  loadConversationFinder,
  loadHostTrips,
  type HostTrip,
} from "@/components/host/data";

export const instant = false;
export const metadata = { title: "Trips" };

const VIEWS: TripView[] = ["requests", "upcoming", "active"];

export default async function HostTripsPage({ searchParams }: PageProps<"/host/trips">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/trips");

  await settleTripStatuses(user.id);
  const [trips, findConversation, { show }] = await Promise.all([
    loadHostTrips(supabase, user.id, ["pending", "approved", "active"]),
    loadConversationFinder(supabase, user.id),
    searchParams,
  ]);

  const requests = trips.filter(isRequest).sort((a, b) => answerBy(a).getTime() - answerBy(b).getTime());
  const upcoming = trips.filter((t) => t.status === "approved" && t.payment_status === "captured");
  const active = trips.filter((t) => t.status === "active");
  const counts = { requests: requests.length, upcoming: upcoming.length, active: active.length };

  const view: TripView = VIEWS.includes(show as TripView)
    ? (show as TripView)
    : requests.length
      ? "requests"
      : active.length
        ? "active"
        : "upcoming";

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title="Trips" action={<TripTabs current={view} counts={counts} />} />

      {view === "requests" && (
        <>
          {requests.length === 0 ? (
            <p className="rounded-[30px] bg-white p-6 text-base text-slate">
              No requests waiting. When a guest asks to book, you&apos;ll answer here.
            </p>
          ) : (
            requests.map((trip) => <RequestFull key={trip.id} trip={trip} conversation={findConversation(trip)} />)
          )}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-4">
            <UpcomingList trips={upcoming.slice(0, 3)} more={upcoming.length - 3} />
            <OnTheRoad trips={active} />
          </div>
        </>
      )}
      {view === "upcoming" && <UpcomingList trips={upcoming} />}
      {view === "active" && <OnTheRoad trips={active} />}
    </div>
  );
}

function TripLine({ trip, detail }: { trip: HostTrip; detail: string }) {
  const status = tripStatus(trip, "host");
  return (
    <div className="flex items-center gap-3 rounded-[18px] bg-board p-3.5">
      <span aria-hidden className={cn("w-2 self-stretch rounded-[4px]", trip.status === "active" ? "bg-cobalt" : "bg-ink")} />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-extrabold">
          {firstName(trip.guest?.full_name)} · {trip.vehicle?.model ?? "Car"}
        </span>
        <span className="text-sm text-slate">
          {detail} · {status.label.toLowerCase()}
        </span>
      </span>
      <span className="figures shrink-0 text-right">
        <span className="block text-base font-extrabold">{formatCurrency(hostEarningsCents(trip.subtotal_cents))}</span>
        <span className="text-[13px] text-slate">to you</span>
      </span>
    </div>
  );
}

function UpcomingList({ trips, more = 0 }: { trips: HostTrip[]; more?: number }) {
  return (
    <section className="flex flex-col gap-3 rounded-[30px] bg-white p-5 sm:p-6">
      <h2 className="text-[26px]">Upcoming</h2>
      {trips.length === 0 ? (
        <p className="rounded-[18px] bg-board p-3.5 text-[15px] text-slate">No confirmed trips coming up.</p>
      ) : (
        trips.map((t) => (
          <TripLine
            key={t.id}
            trip={t}
            detail={`${formatRange(t.starts_at, t.ends_at)}, pick-up ${relativeDays(t.starts_at).toLowerCase()}`}
          />
        ))
      )}
      {more > 0 && (
        <Link href="/host/trips?show=upcoming" className="text-[15px] font-bold hover:text-cobalt">
          {more} more
        </Link>
      )}
    </section>
  );
}

function OnTheRoad({ trips }: { trips: HostTrip[] }) {
  if (trips.length === 0) {
    return (
      <section className="flex flex-col justify-center gap-3 rounded-[30px] bg-mint p-5 text-ink sm:p-6">
        <CarFront className="size-9" strokeWidth={1.75} />
        <h2 className="text-[26px]">Nobody&apos;s on the road</h2>
        <p className="text-[15px] text-mint-ink">
          When a trip starts it shows here with the return time and miles allowed.
        </p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-[30px] bg-mint p-5 text-ink sm:p-6">
      <h2 className="text-[26px]">On the road</h2>
      {trips.map((t) => (
        <TripLine
          key={t.id}
          trip={t}
          detail={`back ${formatDateTime(t.ends_at)}, ${t.distance_included_mi * tripDays(t.starts_at, t.ends_at)} mi allowed`}
        />
      ))}
    </section>
  );
}
