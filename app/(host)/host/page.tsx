import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Clock, Plus } from "lucide-react";
import { createClient, getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { settleTripStatuses } from "@/lib/trips";
import { hostEarningsCents, tripDays } from "@/lib/pricing";
import { cn, formatDate, formatPrice, formatRange, formatTime, relativeDays, toDateKey } from "@/lib/utils";
import type { VehicleImage, Vehicle } from "@/lib/supabase/types";
import { Tag } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { RequestCompact } from "@/components/host/RequestCard";
import { TwoWeekStrip } from "@/components/host/TwoWeekStrip";
import { CarPhoto, coverUrl, firstName, Initial, STATUS_DOT } from "@/components/host/bits";
import { addDays, overlapsDay } from "@/components/host/days";
import {
  answerBy,
  isRequest,
  loadConversationFinder,
  loadHostTrips,
  occupantsFor,
  timeLeft,
  type BlockRow,
  type HostTrip,
} from "@/components/host/data";

export const instant = false;
export const metadata = { title: "Today" };

type CarRow = Pick<
  Vehicle,
  "id" | "make" | "model" | "year" | "daily_rate_cents" | "instant_book" | "status" | "location_address"
> & { vehicle_images: Pick<VehicleImage, "url" | "is_cover" | "position">[] };

type Handover = { trip: HostTrip; kind: "Pick-up" | "Return"; at: string };

const isBooked = (t: HostTrip) =>
  t.payment_status === "captured" && ["approved", "active", "completed"].includes(t.status);

export default async function HostTodayPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login?redirectTo=/host");

  await settleTripStatuses(user.id);

  const now = new Date();
  const today = toDateKey(now);

  const [{ data: carData }, trips, findConversation] = await Promise.all([
    // Addresses and block notes are private columns: read them server-side, scoped to this host.
    createAdminClient()
      .from("vehicles")
      .select("id, make, model, year, daily_rate_cents, instant_book, status, location_address, vehicle_images(url, is_cover, position)")
      .eq("host_id", user.id)
      .order("created_at", { ascending: true }),
    loadHostTrips(supabase, user.id, ["pending", "approved", "active", "completed"]),
    loadConversationFinder(supabase, user.id),
  ]);
  const cars = (carData ?? []) as unknown as CarRow[];

  const { data: blockData } = cars.length
    ? await createAdminClient()
        .from("vehicle_availability")
        .select("id, vehicle_id, blocked_from, blocked_to, reason")
        .in("vehicle_id", cars.map((c) => c.id))
        .gt("blocked_to", now.toISOString())
    : { data: [] as BlockRow[] };
  const blocks = blockData ?? [];

  const requests = trips
    .filter(isRequest)
    .sort((a, b) => answerBy(a).getTime() - answerBy(b).getTime());
  const comingUp = trips
    .flatMap((t): Handover[] => {
      if (t.status === "approved" && t.payment_status === "captured") return [{ trip: t, kind: "Pick-up", at: t.starts_at }];
      if (t.status === "active") return [{ trip: t, kind: "Return", at: t.ends_at }];
      return [];
    })
    .filter(({ at }) => new Date(at).getTime() - now.getTime() < 7 * 86_400_000)
    .sort((a, b) => a.at.localeCompare(b.at));
  const hasFinishedTrip = trips.some((t) => t.status === "completed");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-[15px] font-semibold text-slate">
          {formatDate(now, { weekday: "long", month: "long", day: "numeric", year: undefined })}
        </p>
        <h1 className="headline text-[clamp(46px,6vw,72px)]">Today</h1>
      </div>

      {cars.length === 0 ? (
        <FirstCar />
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,330px),1fr))] gap-4">
            <NeedsYou requests={requests} findConversation={findConversation} />
            <ThisMonth today={today} trips={trips} requests={requests} />
          </div>

          <TwoWeekStrip
            today={today}
            cars={cars.map((c) => ({ id: c.id, name: c.model, occupants: occupantsFor(c.id, trips, blocks) }))}
          />

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,330px),1fr))] gap-4">
            <CarsTile cars={cars} />
            {comingUp.length > 0 || hasFinishedTrip ? (
              <ComingUp items={comingUp} />
            ) : (
              <Checklist cars={cars} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NeedsYou({
  requests,
  findConversation,
}: {
  requests: HostTrip[];
  findConversation: Awaited<ReturnType<typeof loadConversationFinder>>;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[30px] bg-butter p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[26px] sm:text-[28px]">Needs you</h2>
        {requests[0] && (
          <Tag tone="white">
            <Clock className="size-3.5" strokeWidth={2.5} />
            {timeLeft(answerBy(requests[0]))}
          </Tag>
        )}
      </div>
      {requests.length === 0 ? (
        <p className="text-base text-butter-ink">Nothing waiting on you. New booking requests show up here.</p>
      ) : (
        <>
          {requests.slice(0, 2).map((trip) => (
            <RequestCompact key={trip.id} trip={trip} conversation={findConversation(trip)} />
          ))}
          {requests.length > 2 && (
            <Link href="/host/trips" className="text-[15px] font-bold hover:text-cobalt">
              {requests.length - 2} more {requests.length - 2 === 1 ? "request" : "requests"}
            </Link>
          )}
        </>
      )}
    </section>
  );
}

function ThisMonth({ today, trips, requests }: { today: string; trips: HostTrip[]; requests: HostTrip[] }) {
  const monthKey = today.slice(0, 7);
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const keys = Array.from({ length: daysInMonth }, (_, i) => addDays(`${monthKey}-01`, i));

  const booked = trips.filter(isBooked);
  const earned = booked
    .filter((t) => toDateKey(t.starts_at).startsWith(monthKey))
    .reduce((sum, t) => sum + hostEarningsCents(t.subtotal_cents), 0);
  const pending = requests.reduce((sum, t) => sum + hostEarningsCents(t.subtotal_cents), 0);

  const perDay = (list: HostTrip[], key: string) =>
    list
      .filter((t) => overlapsDay(key, t.starts_at, t.ends_at))
      .reduce((sum, t) => sum + hostEarningsCents(t.subtotal_cents) / tripDays(t.starts_at, t.ends_at), 0);
  const bars = keys.map((key) => ({ key, booked: perDay(booked, key), request: perDay(requests, key) }));
  const max = Math.max(1, ...bars.map((b) => b.booked + b.request));
  const monthName = formatDate(`${monthKey}-15T12:00:00Z`, { month: "long", day: undefined, year: undefined });

  return (
    <section className="flex flex-col gap-3.5 rounded-[30px] bg-peach p-5 text-ink sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[26px] sm:text-[28px]">{monthName}</h2>
        <Link href="/host/business/earnings" className="text-sm font-bold hover:text-cobalt">
          Earnings
        </Link>
      </div>
      <div className="figures flex flex-wrap gap-x-7 gap-y-3">
        <div>
          <p className="font-display text-[clamp(40px,5vw,52px)] leading-none font-extrabold tracking-[-0.03em]">
            {formatPrice(earned)}
          </p>
          <p className="mt-1 text-sm font-semibold text-peach-ink">Earned from trips this month</p>
        </div>
        {pending > 0 && (
          <div>
            <p className="font-display text-[clamp(40px,5vw,52px)] leading-none font-extrabold tracking-[-0.03em]">
              {formatPrice(pending)}
            </p>
            <p className="mt-1 text-sm font-semibold text-peach-ink">
              {requests.length === 1
                ? `If you accept ${firstName(requests[0].guest?.full_name)}`
                : `If you accept all ${requests.length}`}
            </p>
          </div>
        )}
      </div>
      <div
        role="img"
        aria-label={`Earnings per day in ${monthName}`}
        className="flex h-20 items-end gap-[3px]"
      >
        {bars.map((b) => {
          const total = b.booked + b.request;
          return (
            <span key={b.key} className="relative flex h-full flex-1 flex-col justify-end">
              {b.key === today && <span aria-hidden className="absolute inset-y-0 -left-[2px] w-0.5 bg-peach-ink" />}
              {total === 0 ? (
                <span className="h-2 rounded-[2px] bg-white" />
              ) : (
                <span className="flex flex-col overflow-hidden rounded-[2px]" style={{ height: `${Math.max(12, (total / max) * 100)}%` }}>
                  {b.request > 0 && <span className="bg-ink/35" style={{ flexGrow: b.request }} />}
                  {b.booked > 0 && <span className="bg-ink" style={{ flexGrow: b.booked }} />}
                </span>
              )}
            </span>
          );
        })}
      </div>
      <div className="flex justify-between text-[13px] font-semibold text-peach-ink">
        <span>{formatDate(keys[0] + "T12:00:00Z", { year: undefined })}</span>
        <span>{formatDate(keys.at(-1) + "T12:00:00Z", { year: undefined })}</span>
      </div>
      <p className="text-sm text-peach-ink">Payouts aren&apos;t set up yet, so nothing has been paid out.</p>
    </section>
  );
}

function CarsTile({ cars }: { cars: CarRow[] }) {
  return (
    <section className="flex flex-col gap-2 rounded-[30px] bg-white p-3">
      {cars.slice(0, 3).map((car) => {
        const status = STATUS_DOT[car.status];
        return (
          <Link
            key={car.id}
            href={`/host/vehicles/${car.id}`}
            className="flex flex-wrap items-center gap-4 rounded-[22px] p-1 transition-colors hover:bg-board"
          >
            <CarPhoto
              src={coverUrl(car.vehicle_images)}
              alt=""
              sizes="150px"
              className="h-[100px] w-[130px] rounded-[20px] sm:h-[118px] sm:w-[150px]"
            />
            <span className="flex min-w-0 flex-[1_1_160px] flex-col gap-2">
              <span className="font-display text-[24px] leading-tight font-extrabold sm:text-[26px]">
                {car.make} {car.model}
              </span>
              <span className="figures text-[15px] text-slate">
                {formatPrice(car.daily_rate_cents)} a day · {car.instant_book ? "instant book" : "request to book"}
              </span>
              <span className="flex items-center gap-2 text-sm font-bold">
                <span className={cn("size-2.5 rounded-full", status.dot)} />
                {car.status === "listed" ? "Listed, showing in search" : status.label}
              </span>
            </span>
          </Link>
        );
      })}
      {cars.length > 3 && (
        <Link href="/host/vehicles" className="px-3 pb-2 text-[15px] font-bold hover:text-cobalt">
          All {cars.length} cars
        </Link>
      )}
    </section>
  );
}

function ComingUp({ items }: { items: Handover[] }) {
  return (
    <section className="flex flex-col gap-3 rounded-[30px] bg-white p-5 sm:p-6">
      <h2 className="text-[26px]">Coming up</h2>
      {items.length === 0 ? (
        <p className="rounded-[18px] bg-board p-3.5 text-[15px] text-slate">No pick-ups or returns this week.</p>
      ) : (
        items.slice(0, 4).map(({ trip, kind, at }) => {
          const guest = firstName(trip.guest?.full_name);
          return (
            <Link
              key={`${trip.id}-${kind}`}
              href={`/host/trips/${trip.id}`}
              className="flex items-center gap-3 rounded-[18px] bg-board p-3.5 hover:bg-line"
            >
              <Initial name={guest} seed={trip.guest_id} className="size-11 rounded-[14px] text-[18px]" />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-extrabold">
                  {kind} · {guest}
                </span>
                <span className="text-sm text-slate">
                  {relativeDays(at)} at {formatTime(at)} · {trip.vehicle?.model ?? "Car"}
                </span>
              </span>
              <Tag tone={kind === "Pick-up" ? "mint" : "sky"}>{formatRange(trip.starts_at, trip.ends_at)}</Tag>
            </Link>
          );
        })
      )}
      <Link href="/host/trips" className="flex items-center gap-1.5 text-[15px] font-bold hover:text-cobalt">
        All trips <ArrowRight className="size-4" />
      </Link>
    </section>
  );
}

function Checklist({ cars }: { cars: CarRow[] }) {
  const items = [
    {
      done: cars.some((c) => c.status === "listed" && c.vehicle_images.length > 0),
      label: "Car listed with photos",
      href: "/host/vehicles",
    },
    {
      done: cars.some((c) => Boolean(c.location_address)),
      label: "Add your exact pickup spot",
      href: "/host/hours",
    },
    { done: false, label: "Payouts aren't set up yet", note: "Bank payouts are coming. Earnings are tracked until then." },
  ];
  const doneCount = items.filter((i) => i.done).length;

  return (
    <section className="flex flex-col gap-3 rounded-[30px] bg-mint p-5 text-ink sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[24px] sm:text-[26px]">Before your first trip</h2>
        <span className="shrink-0 text-sm font-bold">
          {doneCount} of {items.length}
        </span>
      </div>
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2.5 text-base">
          <span
            className={cn(
              "flex size-[26px] shrink-0 items-center justify-center rounded-[9px]",
              item.done ? "bg-ink text-white" : "bg-white"
            )}
          >
            {item.done && <Check className="size-4" strokeWidth={3} />}
          </span>
          {item.done ? (
            <span className="text-mint-ink line-through">{item.label}</span>
          ) : item.href ? (
            <Link href={item.href} className="font-bold hover:text-cobalt">
              {item.label}
            </Link>
          ) : (
            <span>
              <span className="block font-bold">{item.label}</span>
              {item.note && <span className="text-sm text-mint-ink">{item.note}</span>}
            </span>
          )}
        </div>
      ))}
    </section>
  );
}

function FirstCar() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-[30px] bg-butter p-6 text-ink sm:p-8">
      <h2 className="text-[clamp(28px,4vw,40px)] leading-[1.1]">List your first car</h2>
      <p className="max-w-[520px] text-[17px] text-butter-ink">
        Add the car, a few photos and a daily price. Requests and trips show up here once it&apos;s live.
      </p>
      <Button asChild size="lg">
        <Link href="/host/vehicles/new">
          <Plus /> List a car
        </Link>
      </Button>
    </section>
  );
}
