import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mountain, Route } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { settleTripStatuses } from "@/lib/trips";
import { isAbandoned, tripStatus } from "@/lib/trip-status";
import { cn, formatCurrency, formatDateTime, formatRange, relativeDays } from "@/lib/utils";
import { Container, EmptyState, Fact, Tag } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { type TripRow, TRIP_SELECT, carName, hostFirstName, paidLabel, tripGroup } from "./_lib/trip-row";
import { CarPhoto } from "./_components/parts";

export const instant = false;

export const metadata: Metadata = { title: "Your trips" };

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default async function TripsPage({ searchParams }: PageProps<"/trips">) {
  const { tab: tabParam } = await searchParams;
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "upcoming";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/trips");

  await settleTripStatuses(user.id);

  const [{ data }, { data: reviews }] = await Promise.all([
    supabase.from("trips").select(TRIP_SELECT).eq("guest_id", user.id).order("starts_at", { ascending: true }),
    supabase.from("reviews").select("trip_id").eq("reviewer_id", user.id),
  ]);
  const trips = ((data ?? []) as unknown as TripRow[]).filter((t) => !isAbandoned(t));
  const reviewed = new Set((reviews ?? []).map((r) => r.trip_id));

  const groups: Record<TabId, TripRow[]> = { upcoming: [], past: [], cancelled: [] };
  for (const trip of trips) groups[tripGroup(trip)].push(trip);
  // Most recent first for anything already behind us.
  groups.past.reverse();
  groups.cancelled.reverse();
  const shown = groups[tab];

  return (
    <Container className="flex flex-col gap-[18px] pt-9 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="headline text-[clamp(44px,6vw,88px)] leading-none">Your trips</h1>
        <nav role="tablist" className="grid w-full grid-cols-3 gap-1 rounded-[16px] bg-white p-[5px] sm:flex sm:w-auto">
          {TABS.map((t) => {
            const on = t.id === tab;
            const count = groups[t.id].length;
            return (
              <Link
                key={t.id}
                href={t.id === "upcoming" ? "/trips" : `/trips?tab=${t.id}`}
                role="tab"
                aria-selected={on}
                scroll={false}
                className={cn(
                  "flex h-11 items-center justify-center rounded-[12px] px-4 text-[15px] whitespace-nowrap transition-colors",
                  on ? "bg-ink font-bold text-white" : "font-semibold hover:bg-board"
                )}
              >
                {t.label}
                {count > 0 && ` · ${count}`}
              </Link>
            );
          })}
        </nav>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<Route />}
          title={
            tab === "upcoming" ? "No trips coming up." : tab === "past" ? "No past trips yet." : "Nothing cancelled."
          }
          body={tab === "upcoming" ? "Find a car near you and it'll show up here." : undefined}
          action={
            <Button asChild>
              <Link href="/search">Find a car</Link>
            </Button>
          }
        />
      ) : tab === "upcoming" ? (
        <>
          {shown.map((trip) => (
            <UpcomingCard key={trip.id} trip={trip} />
          ))}
          <NextTripTile />
        </>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3">
          {shown.map((trip) => (
            <SmallCard key={trip.id} trip={trip} canReview={trip.status === "completed" && !reviewed.has(trip.id)} />
          ))}
          <NextTripTile />
        </div>
      )}
    </Container>
  );
}

function UpcomingCard({ trip }: { trip: TripRow }) {
  const status = tripStatus(trip, "guest");
  const host = hostFirstName(trip);
  const href = `/trips/${trip.id}`;
  return (
    <article className="flex flex-wrap gap-5 rounded-[32px] bg-white p-3">
      <Link href={href} className="block w-full flex-[1_1_300px] sm:max-w-[420px]">
        <CarPhoto trip={trip} sizes="(min-width: 640px) 420px, 100vw" className="aspect-[4/3] w-full rounded-[24px]" />
      </Link>
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-4 px-2 pb-2 sm:py-3 sm:pr-3 sm:pl-0">
        <div className="flex flex-wrap gap-2">
          <Tag tone={status.tone}>{status.label}</Tag>
          {trip.status !== "active" && <Tag>{relativeDays(trip.starts_at)}</Tag>}
        </div>
        <Link href={href} className="headline text-[clamp(30px,4vw,44px)] leading-[1.12] hover:text-cobalt">
          {carName(trip)} in {trip.pickup_location}
        </Link>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Fact label="Pick-up" value={formatDateTime(trip.starts_at)} />
          <Fact label="Return" value={formatDateTime(trip.ends_at)} />
          <Fact className="figures col-span-2 sm:col-span-1" label={paidLabel(trip)} value={formatCurrency(trip.total_cents)} />
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2 sm:flex">
          <Button asChild>
            <Link href={href}>Open trip</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/messages/new?trip=${trip.id}`}>Message {host}</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function SmallCard({ trip, canReview }: { trip: TripRow; canReview: boolean }) {
  const status = tripStatus(trip, "guest");
  const href = `/trips/${trip.id}`;
  return (
    <article className="flex flex-col gap-3 rounded-[26px] bg-white p-2.5 pb-[18px]">
      <Link href={href}>
        <CarPhoto trip={trip} sizes="(min-width: 640px) 360px, 100vw" className="aspect-video w-full rounded-[18px]" />
      </Link>
      <div className="flex flex-col gap-1.5 px-2">
        <span className="flex flex-wrap items-center gap-2">
          <Tag tone={status.tone}>{status.label}</Tag>
          <span className="text-sm text-slate">{formatRange(trip.starts_at, trip.ends_at)}</span>
        </span>
        <Link href={href} className="font-display text-[22px] font-extrabold hover:text-cobalt">
          {carName(trip)}
        </Link>
        {canReview && (
          <Link href={href} className="text-[15px] font-bold text-cobalt">
            Leave a review
          </Link>
        )}
      </div>
    </article>
  );
}

function NextTripTile() {
  return (
    <Link
      href="/search"
      className="flex min-h-[200px] flex-col justify-between gap-[18px] rounded-[26px] bg-lilac p-6 text-lilac-ink transition-colors hover:bg-[#d6cbff]"
    >
      <Mountain className="size-14 text-ink" strokeWidth={1.5} />
      <span>
        <span className="mb-1.5 block font-display text-[28px] leading-[1.12] font-extrabold tracking-[-0.02em] text-ink">
          Planning the next one?
        </span>
        <span className="text-base font-bold text-ink">Find a car</span>
      </span>
    </Link>
  );
}
