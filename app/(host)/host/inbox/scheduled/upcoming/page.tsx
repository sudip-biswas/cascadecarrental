import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { settleTripStatuses } from "@/lib/trips";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ScheduledMessage, Trip } from "@/lib/supabase/types";
import { formatDateTime, relativeDays } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, Tag, Tile } from "@/components/kit";
import { firstName, Initial } from "@/components/host/bits";
import { ScheduledHeader } from "@/components/messaging/scheduled/ScheduledTabs";
import { SendStatus } from "@/components/messaging/scheduled/SendStatus";

export const instant = false;
export const metadata = { title: "Upcoming scheduled messages" };

type Row = Pick<ScheduledMessage, "id" | "name" | "send_at" | "sent_at" | "status" | "guest_id"> & {
  trip: {
    id: string;
    status: Trip["status"];
    guest: { full_name: string } | null;
    vehicle: { make: string; model: string; year: number } | null;
  } | null;
};

const SELECT =
  "id, name, send_at, sent_at, status, guest_id, trip:trips(id, status, guest:profiles!guest_id(full_name), vehicle:vehicles(make, model, year))";

/** What's still to go out (or skipped, while it could be put back), and what went out this week. */
async function loadQueue(supabase: SupabaseClient<Database>, hostId: string) {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [{ data: waiting }, { data: sent }] = await Promise.all([
    supabase
      .from("scheduled_messages")
      .select(SELECT)
      .eq("host_id", hostId)
      .in("status", ["scheduled", "skipped"])
      .gt("send_at", weekAgo)
      .order("send_at", { ascending: true })
      .limit(200)
      .overrideTypes<Row[], { merge: false }>(),
    supabase
      .from("scheduled_messages")
      .select(SELECT)
      .eq("host_id", hostId)
      .eq("status", "sent")
      .gt("sent_at", weekAgo)
      .order("sent_at", { ascending: false })
      .limit(10)
      .overrideTypes<Row[], { merge: false }>(),
  ]);
  const upcoming = (waiting ?? []).filter(
    (r) => r.trip && !r.trip.status.startsWith("cancelled") && (r.status === "scheduled" || new Date(r.send_at).getTime() > now)
  );
  return { upcoming, sent: sent ?? [], now };
}

export default async function UpcomingScheduledPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/inbox/scheduled/upcoming");

  // Sends anything already due first, so the list is current.
  await settleTripStatuses(user.id);
  const { upcoming, sent, now } = await loadQueue(supabase, user.id);
  const queued = upcoming.filter((r) => r.status === "scheduled").length;

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <ScheduledHeader current="upcoming" upcoming={queued} />

      {upcoming.length === 0 ? (
        <EmptyState
          icon={<CalendarClock strokeWidth={1.75} />}
          title="Nothing scheduled"
          body="When a guest books, the messages from your templates line up here. You can skip any of them for that one trip."
          action={
            <Button asChild variant="secondary">
              <Link href="/host/inbox/scheduled">See your templates</Link>
            </Button>
          }
        />
      ) : (
        <Tile className="flex flex-col gap-1 sm:p-6">
          <h2 className="mb-2 text-[26px] leading-tight">Upcoming</h2>
          <Header />
          <ul className="flex flex-col gap-1">
            {upcoming.map((r) => (
              <Line key={r.id} row={r} now={now}>
                <SendStatus id={r.id} status={r.status as "scheduled" | "skipped"} />
              </Line>
            ))}
          </ul>
        </Tile>
      )}

      {sent.length > 0 && (
        <Tile tone="board" className="flex flex-col gap-1 bg-white/60 sm:p-6">
          <h2 className="mb-2 text-[22px] leading-tight">Sent this week</h2>
          <ul className="flex flex-col gap-1">
            {sent.map((r) => (
              <Line key={r.id} row={r} now={now} time={r.sent_at ?? r.send_at}>
                <Tag tone="mint">Sent</Tag>
              </Line>
            ))}
          </ul>
        </Tile>
      )}

      <p className="px-1 text-sm text-slate">
        Times are Pacific. A message goes out at its time as soon as you or your guest open Cascade, and by the next
        daily check at the latest.
      </p>
    </div>
  );
}

function Header() {
  return (
    <div
      aria-hidden
      className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_200px_130px] gap-4 px-3 pb-1 text-[12px] font-bold tracking-[0.06em] text-quiet uppercase md:grid"
    >
      <span>Trip</span>
      <span>Message</span>
      <span>Goes out</span>
      <span>Status</span>
    </div>
  );
}

function Line({
  row,
  now,
  time = row.send_at,
  children,
}: {
  row: Row;
  now: number;
  time?: string;
  children: React.ReactNode;
}) {
  const car = row.trip?.vehicle ? `${row.trip.vehicle.make} ${row.trip.vehicle.model} ${row.trip.vehicle.year}` : "Car";
  const due = row.status === "scheduled" && new Date(row.send_at).getTime() <= now;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-[18px] p-3 transition-colors hover:bg-board md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_200px_130px]">
      <Link href={`/host/trips/${row.trip?.id}`} className="flex min-w-0 items-center gap-3">
        <Initial name={row.trip?.guest?.full_name} seed={row.guest_id} className="size-10 rounded-[12px] text-[17px]" />
        <span className="min-w-0">
          <span className="block truncate text-base font-extrabold">{firstName(row.trip?.guest?.full_name)}</span>
          <span className="block truncate text-sm text-slate">{car}</span>
        </span>
      </Link>
      <span className="col-start-1 truncate text-[15px] font-semibold md:col-start-auto">{row.name}</span>
      <span className="figures col-start-1 text-sm text-slate md:col-start-auto md:text-[15px] md:text-ink">
        {due ? "Due now" : formatDateTime(time)}
        <span className="block text-[13px] text-slate">{relativeDays(time)}</span>
      </span>
      <span className="col-start-2 row-span-3 row-start-1 md:col-start-auto md:row-span-1 md:row-start-auto">{children}</span>
    </li>
  );
}
