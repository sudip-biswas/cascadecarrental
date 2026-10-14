import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Message, Trip } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export interface Person {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface ThreadTrip {
  id: string;
  starts_at: string;
  ends_at: string;
  status: Trip["status"];
  payment_status: Trip["payment_status"];
  pickup_location: string;
  subtotal_cents: number;
  vehicle: { make: string; model: string; year: number; photo: string | null } | null;
}

export interface ConversationSummary {
  id: string;
  other: Person;
  trip: ThreadTrip | null;
  last: Pick<Message, "body" | "created_at" | "sender_id"> | null;
  unread: number;
}

export interface ConversationRow {
  id: string;
  guest_id: string;
  host_id: string;
  created_at: string;
  guest: Person | null;
  host: Person | null;
  trip: {
    id: string;
    starts_at: string;
    ends_at: string;
    status: Trip["status"];
    payment_status: Trip["payment_status"];
    pickup_location: string;
    subtotal_cents: number;
    vehicle: {
      make: string;
      model: string;
      year: number;
      vehicle_images: { url: string; is_cover: boolean; position: number }[];
    } | null;
  } | null;
}

const CONVERSATION_SELECT = `
  id, guest_id, host_id, created_at,
  guest:profiles!guest_id(id, full_name, avatar_url),
  host:profiles!host_id(id, full_name, avatar_url),
  trip:trips(id, starts_at, ends_at, status, payment_status, pickup_location, subtotal_cents,
    vehicle:vehicles(make, model, year, vehicle_images(url, is_cover, position)))
`;

const nobody: Person = { id: "", full_name: "Someone", avatar_url: null };

export function toThreadTrip(trip: ConversationRow["trip"]): ThreadTrip | null {
  if (!trip) return null;
  const images = [...(trip.vehicle?.vehicle_images ?? [])].sort(
    (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.position - b.position
  );
  return {
    ...trip,
    vehicle: trip.vehicle
      ? { make: trip.vehicle.make, model: trip.vehicle.model, year: trip.vehicle.year, photo: images[0]?.url ?? null }
      : null,
  };
}

function otherParty(row: ConversationRow, userId: string): Person {
  return (row.guest_id === userId ? row.host : row.guest) ?? nobody;
}

/** Conversations where this person is the guest, or the host, newest activity first. */
export async function listConversations(
  supabase: Client,
  userId: string,
  as: "guest" | "host"
): Promise<ConversationSummary[]> {
  const { data } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq(as === "guest" ? "guest_id" : "host_id", userId);
  const rows = (data ?? []) as unknown as ConversationRow[];
  if (!rows.length) return [];

  const ids = rows.map((r) => r.id);
  const [{ data: recent }, { data: unread }] = await Promise.all([
    supabase
      .from("messages")
      .select("conversation_id, body, created_at, sender_id")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", ids)
      .is("read_at", null)
      .neq("sender_id", userId),
  ]);

  const lastById = new Map<string, ConversationSummary["last"]>();
  for (const m of recent ?? []) {
    if (!lastById.has(m.conversation_id)) lastById.set(m.conversation_id, m);
  }
  const unreadById = new Map<string, number>();
  for (const m of unread ?? []) {
    unreadById.set(m.conversation_id, (unreadById.get(m.conversation_id) ?? 0) + 1);
  }

  const activity = (row: ConversationRow) => lastById.get(row.id)?.created_at ?? row.created_at;
  return rows
    .sort((a, b) => activity(b).localeCompare(activity(a)))
    .map((row) => ({
      id: row.id,
      other: otherParty(row, userId),
      trip: toThreadTrip(row.trip),
      last: lastById.get(row.id) ?? null,
      unread: unreadById.get(row.id) ?? 0,
    }));
}

export interface ConversationDetail {
  id: string;
  other: Person;
  role: "guest" | "host";
  trip: ThreadTrip | null;
  messages: Message[];
}

/**
 * One conversation with its messages, or null if this person isn't in it.
 * Opening it marks the other person's messages read.
 */
export async function openConversation(
  supabase: Client,
  conversationId: string,
  userId: string
): Promise<ConversationDetail | null> {
  const { data } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("id", conversationId)
    .maybeSingle();
  const row = data as unknown as ConversationRow | null;
  if (!row || (row.guest_id !== userId && row.host_id !== userId)) return null;

  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", userId)
    .is("read_at", null);

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return {
    id: row.id,
    other: otherParty(row, userId),
    role: row.guest_id === userId ? "guest" : "host",
    trip: toThreadTrip(row.trip),
    messages: messages ?? [],
  };
}
