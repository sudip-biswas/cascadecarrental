import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { notifyMessage } from "@/lib/notify";

// In-memory rate limit: keyed by IP or email, value = last submission timestamp.
// Resets on cold starts; acceptable for a low-traffic contact form.
const rateMap = new Map<string, number>();

function ipFrom(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

function tooSoon(key: string, windowMs: number): boolean {
  const last = rateMap.get(key) ?? 0;
  return Date.now() - last < windowMs;
}

/** Returns the host_id of the first listed vehicle (the fleet owner). */
async function findFleetHostId(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("vehicles")
    .select("host_id")
    .eq("status", "listed")
    .limit(1)
    .maybeSingle();
  return data?.host_id ?? null;
}

/**
 * Finds an existing Supabase Auth user by email, or creates one.
 * Uses email_confirm:true so no confirmation email is sent.
 * The DB trigger auto-creates the profiles row on insert.
 */
async function findOrCreateGuestUser(email: string, fullName: string): Promise<string> {
  const admin = createAdminClient();

  // Attempt creation first (happy path for first-time enquirers).
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (!error) {
    // Trigger created the profile; ensure the name is exactly what they typed.
    await admin.from("profiles").update({ full_name: fullName }).eq("id", data.user.id);
    return data.user.id;
  }

  // User already exists – look them up via the auth schema (service role has access).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: found } = await (admin as any)
    .schema("auth")
    .from("users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (!found?.id) throw new Error(`Cannot resolve guest user for ${email}`);
  return found.id as string;
}

/**
 * Returns the id of the latest null-trip conversation between this guest
 * and host, creating one if none exists yet.
 */
async function findOrCreateInquiryConversation(guestId: string, hostId: string): Promise<string> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("guest_id", guestId)
    .eq("host_id", hostId)
    .is("trip_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created } = await admin
    .from("conversations")
    .insert({ guest_id: guestId, host_id: hostId, trip_id: null })
    .select("id")
    .single();

  if (!created?.id) throw new Error("Failed to create inquiry conversation");
  return created.id;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    /** Car name from a car-page link, e.g. "2023 Toyota Camry". */
    car?: string;
    from?: string;
    until?: string;
    _honey?: string;
  };

  // Honeypot: bots fill this hidden field. Silently accept so they don't retry.
  if (body._honey) return NextResponse.json({ ok: true });

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const phone = body.phone?.trim() ?? "";
  const message = body.message?.trim() ?? "";
  const car = body.car?.trim() ?? "";
  const from = body.from?.trim() ?? "";
  const until = body.until?.trim() ?? "";

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "Message is too long (max 2000 characters)." }, { status: 400 });
  }

  // Rate limit: 1 per IP per minute, 1 per email per 5 minutes.
  const ip = ipFrom(req);
  if (tooSoon(`ip:${ip}`, 60_000) || tooSoon(`em:${email.toLowerCase()}`, 300_000)) {
    return NextResponse.json({ error: "Please wait a moment before sending another message." }, { status: 429 });
  }
  rateMap.set(`ip:${ip}`, Date.now());
  rateMap.set(`em:${email.toLowerCase()}`, Date.now());

  // Build platform message: car/dates context at top (req #5), then the inquiry.
  const contextLines: string[] = [];
  if (car) contextLines.push(`Car: ${car}`);
  if (from && until) contextLines.push(`Dates: ${from} → ${until}`);
  else if (from) contextLines.push(`From: ${from}`);
  if (phone) contextLines.push(`Phone: ${phone}`);

  const platformBody = [
    "[Website inquiry]",
    ...contextLines,
    "",
    message,
  ].join("\n");

  let usedPlatformThread = false;
  try {
    const hostId = await findFleetHostId();
    if (hostId) {
      const guestId = await findOrCreateGuestUser(email, name);
      const convId = await findOrCreateInquiryConversation(guestId, hostId);

      // Insert the message bypassing RLS (admin client).
      const admin = createAdminClient();
      const { error: msgErr } = await admin
        .from("messages")
        .insert({ conversation_id: convId, sender_id: guestId, body: platformBody, photos: [] });

      if (msgErr) throw new Error(msgErr.message);

      // Notify the host: creates the inbox badge + sends them an email.
      // Reply-To = guest email so the host can reply directly from their inbox.
      await notifyMessage(convId, guestId, platformBody, 0, email);
      usedPlatformThread = true;
    }
  } catch (err) {
    console.error("[contact] platform thread failed, falling back to plain email:", err);
  }

  // Fallback: if the platform thread couldn't be created, email the inbox directly.
  if (!usedPlatformThread) {
    const inbox = process.env.CONTACT_EMAIL ?? "sudip@cascadecarrental.com";
    await sendEmail({
      to: inbox,
      subject: `Inquiry from ${name}`,
      replyTo: email,
      lines: [
        `Name: ${name}`,
        `Email: ${email}`,
        ...(phone ? [`Phone: ${phone}`] : []),
        ...(car ? [`Car: ${car}`] : []),
        ...(from ? [`Dates: ${from}${until ? ` → ${until}` : ""}`] : []),
        ``,
        message,
      ],
    });
  }

  // Guest confirmation email (unchanged from original).
  await sendEmail({
    to: email,
    subject: "We got your message — Cascade Car Rental",
    lines: [
      `Hi ${name.split(" ")[0]},`,
      "We received your message and will get back to you shortly — usually within a few hours.",
      "In the meantime, feel free to browse available cars.",
    ],
    action: { label: "Browse cars", href: "/seattle" },
  });

  return NextResponse.json({ ok: true });
}
