import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, CalendarDays, CarFront, MessageSquare, RotateCcw, Star, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Tile, TileTitle, toneClass, type Tone } from "@/components/kit";
import { listConversations } from "@/components/messaging/inbox";
import { settleTripStatuses } from "@/lib/trips";
import { cn, formatDateShort, formatDateTime, formatRange, pluralize } from "@/lib/utils";

export const instant = false;
export const metadata = { title: "Notifications" };

interface Item {
  key: string;
  href: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  detail: string;
  unread?: boolean;
}

interface TripRow {
  id: string;
  starts_at: string;
  ends_at: string;
  guest: { full_name: string } | null;
  vehicle: { make: string; model: string } | null;
}

interface ReviewRow {
  id: string;
  rating_overall: number;
  created_at: string;
  reviewer: { full_name: string } | null;
  vehicle: { model: string } | null;
}

const TRIP_SELECT = "id, starts_at, ends_at, guest:profiles!guest_id(full_name), vehicle:vehicles(make, model)";
const DAY = 24 * 60 * 60 * 1000;

export default async function HostNotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/notifications");

  await settleTripStatuses(user.id);

  const now = new Date();
  const soon = new Date(now.getTime() + 2 * DAY).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * DAY).toISOString();

  const [requests, pickups, returns, reviews, conversations] = await Promise.all([
    supabase
      .from("trips")
      .select(TRIP_SELECT)
      .eq("host_id", user.id)
      .eq("status", "pending")
      .eq("payment_status", "authorized")
      .order("starts_at"),
    supabase
      .from("trips")
      .select(TRIP_SELECT)
      .eq("host_id", user.id)
      .eq("status", "approved")
      .gte("starts_at", now.toISOString())
      .lte("starts_at", soon)
      .order("starts_at"),
    supabase
      .from("trips")
      .select(TRIP_SELECT)
      .eq("host_id", user.id)
      .in("status", ["approved", "active"])
      .gte("ends_at", now.toISOString())
      .lte("ends_at", soon)
      .order("ends_at"),
    supabase
      .from("reviews")
      .select("id, rating_overall, created_at, reviewer:profiles!reviewer_id(full_name), vehicle:vehicles(model)")
      .eq("reviewee_id", user.id)
      .gte("created_at", monthAgo)
      .order("created_at", { ascending: false }),
    listConversations(supabase, user.id, "host"),
  ]);

  const car = (t: TripRow) => t.vehicle?.model ?? "car";
  const guest = (t: TripRow) => t.guest?.full_name || "A guest";

  const needsYou: Item[] = [
    ...((requests.data ?? []) as unknown as TripRow[]).map((t) => ({
      key: `request-${t.id}`,
      href: "/host",
      icon: CalendarDays,
      tone: "butter" as const,
      title: `New request from ${guest(t)}`,
      detail: `${car(t)} · ${formatRange(t.starts_at, t.ends_at)} · answer before pick-up`,
      unread: true,
    })),
    ...conversations
      .filter((c) => c.unread > 0)
      .map((c) => ({
        key: `message-${c.id}`,
        href: `/host/inbox/${c.id}`,
        icon: MessageSquare,
        tone: "sky" as const,
        title: c.unread > 1 ? `${c.other.full_name} sent ${pluralize(c.unread, "message")}` : `${c.other.full_name} sent a message`,
        detail: c.last ? `“${c.last.body}”` : "",
        unread: true,
      })),
  ];

  const comingUp: Item[] = [
    ...((pickups.data ?? []) as unknown as TripRow[]).map((t) => ({
      key: `pickup-${t.id}`,
      href: "/host/trips",
      icon: CarFront,
      tone: "mint" as const,
      title: `${guest(t)} picks up the ${car(t)}`,
      detail: formatDateTime(t.starts_at),
    })),
    ...((returns.data ?? []) as unknown as TripRow[]).map((t) => ({
      key: `return-${t.id}`,
      href: "/host/trips",
      icon: RotateCcw,
      tone: "lilac" as const,
      title: `The ${car(t)} comes back from ${guest(t)}`,
      detail: formatDateTime(t.ends_at),
    })),
  ];

  const earlier: Item[] = ((reviews.data ?? []) as unknown as ReviewRow[]).map((r) => ({
    key: `review-${r.id}`,
    href: "/host/business/ratings",
    icon: Star,
    tone: "peach" as const,
    title: `${r.reviewer?.full_name || "A guest"} gave the ${r.vehicle?.model ?? "car"} ${pluralize(r.rating_overall, "star")}`,
    detail: formatDateShort(r.created_at),
  }));

  const groups = [
    { label: "Needs you", items: needsYou },
    { label: "Next 48 hours", items: comingUp },
    { label: "Reviews this month", items: earlier },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <PageTitle title="Notifications" />

      <div className="flex flex-wrap items-start gap-4">
        <Tile className="flex min-w-0 flex-[999_1_480px] flex-col gap-1.5 p-3.5 sm:p-3.5">
          {groups.length === 0 ? (
            <div className="flex flex-col items-start gap-3 px-2 py-8">
              <span className="flex size-12 items-center justify-center rounded-[14px] bg-board">
                <Bell className="size-6" strokeWidth={1.75} />
              </span>
              <h2 className="text-[26px] leading-tight">All quiet.</h2>
              <p className="max-w-[440px] text-base text-slate">
                New requests, guest messages, pick-ups and returns in the next two days, and new reviews show up here.
              </p>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.label} className="flex flex-col gap-1.5">
                <h2 className="px-2 pt-1.5 pb-1 font-sans text-[13px] font-bold text-slate">{group.label}</h2>
                {group.items.map((item) => (
                  <NotificationRow key={item.key} item={item} />
                ))}
              </section>
            ))
          )}
        </Tile>

        <Tile className="flex min-w-0 flex-[1_1_320px] flex-col gap-2 p-[22px]">
          <TileTitle>About these</TileTitle>
          <p className="text-[15px] text-slate">
            Cascade doesn&apos;t send email or text alerts yet, so check here and your inbox for requests. Answer
            requests before pick-up, or they close on their own and the guest&apos;s card is released.
          </p>
          <p className="text-[15px] text-slate">Payouts aren&apos;t set up yet, so there are no payout updates here.</p>
        </Tile>
      </div>
    </div>
  );
}

function NotificationRow({ item }: { item: Item }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3.5 rounded-[18px] p-3.5 transition-colors",
        item.unread ? "bg-board hover:bg-line" : "hover:bg-board"
      )}
    >
      <span className={cn("flex size-[46px] flex-none items-center justify-center rounded-[14px]", toneClass[item.tone])}>
        <Icon className="size-[22px]" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-base", item.unread ? "font-extrabold" : "font-bold")}>{item.title}</span>
        {item.detail && <span className="truncate text-sm text-slate">{item.detail}</span>}
      </span>
      {item.unread && (
        <span className="size-2.5 flex-none rounded-[5px] bg-cobalt">
          <span className="sr-only">New</span>
        </span>
      )}
    </Link>
  );
}
