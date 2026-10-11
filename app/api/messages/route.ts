import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  recipientId: z.string().uuid(),
  body: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
  tripId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }

  const { recipientId, body: messageBody, conversationId, tripId } = parsed.data;

  let convId = conversationId;

  if (!convId) {
    // Determine guest/host roles
    const { data: recipient } = await supabase
      .from("profiles")
      .select("is_host")
      .eq("id", recipientId)
      .single();

    const { data: sender } = await supabase
      .from("profiles")
      .select("is_host")
      .eq("id", user.id)
      .single();

    const guestId = sender?.is_host ? recipientId : user.id;
    const hostId = sender?.is_host ? user.id : recipientId;

    // Find or create conversation
    const baseQuery = supabase
      .from("conversations")
      .select("id")
      .eq("guest_id", guestId)
      .eq("host_id", hostId);
    const { data: existing } = await (
      tripId ? baseQuery.eq("trip_id", tripId) : baseQuery.is("trip_id", null)
    ).single();

    if (existing) {
      convId = existing.id;
    } else {
      const { data: newConv } = await supabase
        .from("conversations")
        .insert({ guest_id: guestId, host_id: hostId, trip_id: tripId ?? null })
        .select()
        .single();
      convId = newConv?.id;
    }
  }

  if (!convId) {
    return NextResponse.json({ error: "Failed to get conversation" }, { status: 500 });
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({ conversation_id: convId, sender_id: user.id, body: messageBody })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message, conversationId: convId });
}
