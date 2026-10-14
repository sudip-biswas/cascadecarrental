import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { settleTripStatuses } from "@/lib/trips";
import { cn, formatDateShort, pluralize, zonedInstant } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, PageTitle, Tag, Tile, TileTitle } from "@/components/kit";
import { blockDateKeys, lastDays, tripDateKeys, weekday } from "../_lib/days";
import { CANCEL_REASON } from "@/lib/trip-status";
import { hostTrips, isPaidTrip } from "../_lib/trips";

export const instant = false;
export const metadata = { title: "Performance" };

const WINDOW = 90;

type CarRow = { id: string; make: string; model: string; instant_book: boolean; weekly_discount_pct: number };
type ConversationRow = { messages: { sender_id: string; created_at: string }[] };

/** Median wait, in minutes, between a guest writing and the host's next reply. */
function medianReplyMinutes(conversations: ConversationRow[], hostId: string, since: string): number | null {
  const waits: number[] = [];
  for (const c of conversations) {
    const msgs = [...c.messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
    let waitingSince: string | null = null;
    for (const m of msgs) {
      if (m.sender_id !== hostId) {
        waitingSince ??= m.created_at;
      } else if (waitingSince) {
        if (waitingSince >= since) waits.push((Date.parse(m.created_at) - Date.parse(waitingSince)) / 60_000);
        waitingSince = null;
      }
    }
  }
  if (!waits.length) return null;
  waits.sort((a, b) => a - b);
  const mid = Math.floor(waits.length / 2);
  return waits.length % 2 ? waits[mid] : (waits[mid - 1] + waits[mid]) / 2;
}

function formatWait(minutes: number): string {
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))} min`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 6) / 10} h`;
  return pluralize(Math.round(minutes / 1440), "day");
}

const cellTone = { booked: "bg-ink", blocked: "bg-[#c9ccd3]", open: "bg-board" } as const;

export default async function PerformancePage({ searchParams }: PageProps<"/host/business/performance">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/business/performance");

  await settleTripStatuses(user.id);
  const [{ car: carParam }, { data: carsData }, trips, { data: convData }] = await Promise.all([
    searchParams,
    supabase
      .from("vehicles")
      .select("id, make, model, instant_book, weekly_discount_pct")
      .eq("host_id", user.id)
      .order("created_at", { ascending: true }),
    hostTrips(user.id),
    supabase.from("conversations").select("messages(sender_id, created_at)").eq("host_id", user.id),
  ]);
  const cars = (carsData ?? []) as CarRow[];

  if (cars.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
        <PageTitle title="Performance" />
        <EmptyState
          title="No cars yet"
          body="List a car and this is where you'll see how often it's booked and how quickly you reply."
          action={
            <Button asChild>
              <Link href="/host/vehicles/new">List a car</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const car = cars.find((c) => c.id === carParam) ?? cars[0];
  const { data: blocks } = await supabase
    .from("vehicle_availability")
    .select("blocked_from, blocked_to")
    .eq("vehicle_id", car.id);

  const days = lastDays(new Date(), WINDOW);
  const since = zonedInstant(days[0], "00:00").toISOString();

  // The selected car's last 90 days.
  const booked = new Set(
    trips.filter((t) => t.vehicle_id === car.id && isPaidTrip(t)).flatMap((t) => tripDateKeys(t.starts_at, t.ends_at))
  );
  const blocked = new Set((blocks ?? []).flatMap((b) => blockDateKeys(b.blocked_from, b.blocked_to)));
  const cells = days.map((key) => (booked.has(key) ? "booked" : blocked.has(key) ? "blocked" : "open"));
  const bookedDays = days.filter((key) => booked.has(key));
  const share = bookedDays.length / WINDOW;
  const weekendDays = bookedDays.filter((key) => [0, 5, 6].includes(weekday(key))).length;

  // Requests across all cars, made in the window.
  const recent = trips.filter((t) => t.created_at >= since);
  const requestCars = new Set(cars.filter((c) => !c.instant_book).map((c) => c.id));
  const accepted = recent.filter((t) => requestCars.has(t.vehicle_id) && isPaidTrip(t)).length;
  const declined = recent.filter((t) => t.status === "cancelled_host" && t.cancellation_reason === CANCEL_REASON.declined).length;
  const missed = recent.filter((t) => t.status === "cancelled_host" && t.cancellation_reason === CANCEL_REASON.hostMissed).length;
  const answered = accepted + declined + missed;
  const cancelledByYou = recent.filter(
    (t) => t.status === "cancelled_host" && t.cancellation_reason === CANCEL_REASON.byHost
  ).length;

  const reply = medianReplyMinutes((convData ?? []) as ConversationRow[], user.id, since);
  const circumference = 2 * Math.PI * 16;
  const carName = `${car.make} ${car.model}`;
  const tick = (i: number) => formatDateShort(zonedInstant(days[i]));

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <PageTitle title="Performance" action={<Tag tone="white" className="px-3.5 py-3 text-[15px]">Last 90 days</Tag>} />

      {cars.length > 1 && (
        <nav aria-label="Car" className="flex flex-wrap gap-2">
          {cars.map((c) => (
            <Link
              key={c.id}
              href={`?car=${c.id}`}
              aria-current={c.id === car.id ? "true" : undefined}
              className={cn(
                "rounded-[12px] px-3.5 py-2.5 text-[15px] font-bold transition-colors",
                c.id === car.id ? "bg-ink text-white" : "bg-white hover:bg-line"
              )}
            >
              {c.make} {c.model}
            </Link>
          ))}
        </nav>
      )}

      <div className="figures grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        <Tile className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-slate">Days booked · {carName}</span>
          <span className="flex items-center gap-4">
            <svg width="92" height="92" viewBox="0 0 42 42" role="img" aria-label={`${bookedDays.length} of ${WINDOW} days booked`}>
              <circle cx="21" cy="21" r="16" fill="none" stroke="#E9EBEF" strokeWidth="7" />
              {bookedDays.length > 0 && (
                <circle
                  cx="21"
                  cy="21"
                  r="16"
                  fill="none"
                  stroke="#111111"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={`${share * circumference} ${circumference}`}
                  transform="rotate(-90 21 21)"
                />
              )}
            </svg>
            <span className="flex flex-col gap-1.5">
              <span className="font-display text-[44px] leading-none font-extrabold">{Math.round(share * 100)}%</span>
              <span className="text-sm text-slate">
                {bookedDays.length} of {WINDOW} days
              </span>
            </span>
          </span>
        </Tile>

        <Tile tone="mint" className="flex flex-col gap-3">
          <span className="text-sm font-semibold">Requests accepted</span>
          {answered > 0 ? (
            <>
              <span className="font-display text-[52px] leading-none font-extrabold text-ink">
                {accepted} of {answered}
              </span>
              {answered <= 12 ? (
                <span className="grid gap-[5px]" style={{ gridTemplateColumns: `repeat(${answered}, minmax(0, 1fr))` }}>
                  {Array.from({ length: answered }, (_, i) => (
                    <span key={i} className={cn("h-2.5 rounded-[5px]", i < accepted ? "bg-ink" : "bg-white")} />
                  ))}
                </span>
              ) : (
                <span className="h-2.5 overflow-hidden rounded-[5px] bg-white">
                  <span className="block h-full bg-ink" style={{ width: `${(accepted / answered) * 100}%` }} />
                </span>
              )}
              {missed > 0 && <span className="text-sm">{pluralize(missed, "request")} ran out of time.</span>}
            </>
          ) : (
            <>
              <span className="font-display text-[52px] leading-none font-extrabold text-ink">–</span>
              <span className="text-sm">
                {requestCars.size === 0 ? "Instant book is on, so guests don't need to ask." : "No requests yet."}
              </span>
            </>
          )}
        </Tile>

        <Tile tone="sky" className="flex flex-col gap-3">
          <span className="text-sm font-semibold">Typical reply time</span>
          <span className="font-display text-[52px] leading-none font-extrabold text-ink">
            {reply === null ? "–" : formatWait(reply)}
          </span>
          <span className="text-sm">
            {reply === null ? "No guest messages yet." : "How long guests usually wait for your first reply."}
          </span>
        </Tile>

        <Tile className="flex flex-col gap-3">
          <span className="text-sm font-semibold text-slate">Cancelled by you</span>
          <span className="font-display text-[52px] leading-none font-extrabold">{cancelledByYou}</span>
          <span className="text-sm text-slate">
            {cancelledByYou === 0 ? "Keep it here. Guests count on their booking." : "Guests count on their booking, so try to keep this at zero."}
          </span>
        </Tile>
      </div>

      <Tile className="flex flex-col gap-3.5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <TileTitle>90 days of the {car.model}</TileTitle>
          <span className="flex gap-3.5 text-sm text-slate">
            {(["booked", "blocked", "open"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1.5 capitalize">
                <span className={cn("size-3 rounded-[4px]", cellTone[k])} />
                {k}
              </span>
            ))}
          </span>
        </div>
        <div className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-[2px] sm:gap-1" aria-hidden>
          {cells.map((c, i) => (
            <span key={days[i]} title={`${tick(i)}: ${c}`} className={cn("aspect-square rounded-[3px] sm:rounded-[4px]", cellTone[c])} />
          ))}
        </div>
        <div className="flex justify-between text-[13px] font-semibold text-slate">
          <span>{tick(0)}</span>
          <span>{tick(30)}</span>
          <span>{tick(60)}</span>
          <span>{tick(WINDOW - 1)}</span>
        </div>
      </Tile>

      {bookedDays.length >= 4 && weekendDays / bookedDays.length >= 0.6 && car.weekly_discount_pct === 0 && (
        <Tile tone="butter" className="flex flex-wrap items-center gap-5 sm:p-6">
          <span className="flex flex-[1_1_280px] flex-col gap-1.5">
            <span className="font-display text-[26px] font-extrabold text-ink sm:text-[28px]">Weekends go first</span>
            <span className="text-base">
              {weekendDays} of your {bookedDays.length} booked days were Friday to Sunday. A weekly discount can fill the
              weekdays.
            </span>
          </span>
          <Button asChild>
            <Link href={`/host/vehicles/${car.id}`}>Set a weekly discount</Link>
          </Button>
        </Tile>
      )}
    </div>
  );
}
