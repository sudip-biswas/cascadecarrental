import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NO_INDEX } from "@/lib/site";
import { Container } from "@/components/kit";
import { MessageThread } from "@/components/messaging/MessageThread";
import { ThreadHeader } from "@/components/messaging/ThreadHeader";
import { toThreadTrip, type ConversationRow, type Person } from "@/components/messaging/inbox";
import { GUEST_REPLIES, HOST_REPLIES } from "@/components/messaging/replies";

export const instant = false;
export const metadata = { title: "New message", ...NO_INDEX };

type TripRow = NonNullable<ConversationRow["trip"]> & {
  guest_id: string;
  host_id: string;
  guest: Person | null;
  host: Person | null;
};

const TRIP_SELECT = `
  id, guest_id, host_id, starts_at, ends_at, status, payment_status, pickup_location, subtotal_cents,
  guest:profiles!guest_id(id, full_name, avatar_url),
  host:profiles!host_id(id, full_name, avatar_url),
  vehicle:vehicles(make, model, year, vehicle_images(url, is_cover, position))
`;

/**
 * Starts a conversation: `?trip=<id>` about a booking, or `?host=<id>` to ask
 * a host something before booking. Goes straight to the thread if one exists.
 */
export default async function NewMessagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { trip: tripParam, host: hostParam } = await searchParams;
  const tripId = typeof tripParam === "string" ? tripParam : undefined;
  const hostId = typeof hostParam === "string" ? hostParam : undefined;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const here = tripId ? `/messages/new?trip=${tripId}` : `/messages/new?host=${hostId ?? ""}`;
    redirect(`/login?redirectTo=${encodeURIComponent(here)}`);
  }

  if (tripId) {
    const { data } = await supabase.from("trips").select(TRIP_SELECT).eq("id", tripId).maybeSingle();
    const trip = data as unknown as TripRow | null;
    if (!trip) notFound();

    const role = trip.guest_id === user.id ? "guest" : "host";
    const basePath = role === "guest" ? "/messages" : "/host/inbox";
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("trip_id", trip.id)
      .eq("guest_id", trip.guest_id)
      .eq("host_id", trip.host_id)
      .maybeSingle();
    if (existing) redirect(`${basePath}/${existing.id}`);

    const other = (role === "guest" ? trip.host : trip.guest) ?? { id: "", full_name: "Someone", avatar_url: null };
    return (
      <Composer
        otherName={other.full_name}
        basePath={basePath}
        userId={user.id}
        start={{ tripId: trip.id }}
        quickReplies={role === "guest" ? GUEST_REPLIES : HOST_REPLIES}
        header={
          <ThreadHeader otherName={other.full_name} trip={toThreadTrip(trip)} viewer={role} backHref={basePath} />
        }
      />
    );
  }

  if (!hostId || hostId === user.id) notFound();
  const { data: host } = await supabase.from("profiles").select("id, full_name, is_host").eq("id", hostId).maybeSingle();
  if (!host?.is_host) notFound();

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("guest_id", user.id)
    .eq("host_id", host.id)
    .is("trip_id", null)
    .maybeSingle();
  if (existing) redirect(`/messages/${existing.id}`);

  return (
    <Composer
      otherName={host.full_name || "the host"}
      basePath="/messages"
      userId={user.id}
      start={{ recipientId: host.id }}
      header={<ThreadHeader otherName={host.full_name || "Host"} trip={null} viewer="guest" backHref="/messages" />}
    />
  );
}

function Composer({
  otherName,
  basePath,
  userId,
  start,
  quickReplies,
  header,
}: {
  otherName: string;
  basePath: string;
  userId: string;
  start: { tripId?: string; recipientId?: string };
  quickReplies?: string[];
  header: React.ReactNode;
}) {
  return (
    <Container className="max-w-[880px] px-0 sm:px-0 md:px-6 md:py-6">
      <div className="flex md:h-[calc(100dvh-118px)] md:min-h-[480px]">
        <MessageThread
          conversationId={null}
          initialMessages={[]}
          currentUserId={userId}
          otherName={otherName}
          start={start}
          basePath={basePath}
          quickReplies={quickReplies}
          header={header}
          className="h-[calc(100dvh-70px)] rounded-none md:h-auto md:rounded-[28px]"
        />
      </div>
    </Container>
  );
}
