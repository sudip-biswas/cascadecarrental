import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyMessageLater } from "@/lib/notify";

const schema = z.object({
  body: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  /** Starting a new conversation: who it's with. */
  recipientId: z.string().uuid().optional(),
  tripId: z.string().uuid().optional(),
});

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** Works out who is the guest and who is the host for a new conversation. */
async function resolveParties(userId: string, recipientId?: string, tripId?: string) {
  const admin = createAdminClient();
  if (tripId) {
    const { data: trip } = await admin
      .from("trips")
      .select("guest_id, host_id")
      .eq("id", tripId)
      .single();
    if (!trip || (trip.guest_id !== userId && trip.host_id !== userId)) return null;
    return { guestId: trip.guest_id, hostId: trip.host_id, tripId };
  }
  if (!recipientId || recipientId === userId) return null;
  const { data: recipient } = await admin
    .from("profiles")
    .select("id, is_host")
    .eq("id", recipientId)
    .single();
  // Without a trip, conversations are started by guests asking a host about a car.
  if (!recipient?.is_host) return null;
  return { guestId: userId, hostId: recipientId, tripId: null };
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Unauthorized", 401);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Write a message first.", 400);
  const { body, conversationId, recipientId, tripId } = parsed.data;

  let convId = conversationId;

  if (!convId) {
    const parties = await resolveParties(user.id, recipientId, tripId);
    if (!parties) return fail("Can't start that conversation.", 400);

    const query = supabase
      .from("conversations")
      .select("id")
      .eq("guest_id", parties.guestId)
      .eq("host_id", parties.hostId);
    const { data: existing } = await (parties.tripId
      ? query.eq("trip_id", parties.tripId)
      : query.is("trip_id", null)
    ).maybeSingle();

    if (existing) {
      convId = existing.id;
    } else {
      const { data: created } = await supabase
        .from("conversations")
        .insert({ guest_id: parties.guestId, host_id: parties.hostId, trip_id: parties.tripId })
        .select("id")
        .single();
      convId = created?.id;
    }
  }

  if (!convId) return fail("Failed to start the conversation.", 500);

  // RLS only lets participants post.
  const { data: message, error } = await supabase
    .from("messages")
    .insert({ conversation_id: convId, sender_id: user.id, body })
    .select()
    .single();

  if (error) return fail("Message not sent. Try again.", 500);

  notifyMessageLater(convId, user.id, body);

  return NextResponse.json({ message, conversationId: convId });
}
