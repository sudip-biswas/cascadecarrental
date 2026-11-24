import { NextResponse, type NextRequest } from "next/server";
import { sendEmail } from "@/lib/email";

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

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    _honey?: string;
  };

  // Honeypot: bots fill this hidden field. Silently accept so they don't retry.
  if (body._honey) return NextResponse.json({ ok: true });

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const phone = body.phone?.trim() ?? "";
  const message = body.message?.trim() ?? "";

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

  const inbox = process.env.CONTACT_EMAIL ?? "sudip@cascadecarrental.com";

  await Promise.all([
    // Notify the team, Reply-To the guest so we can reply directly.
    sendEmail({
      to: inbox,
      subject: `Inquiry from ${name}`,
      replyTo: email,
      lines: [
        `Name: ${name}`,
        `Email: ${email}`,
        ...(phone ? [`Phone: ${phone}`] : []),
        ``,
        message,
      ],
    }),
    // Confirm receipt to the guest.
    sendEmail({
      to: email,
      subject: "We got your message — Cascade Car Rental",
      lines: [
        `Hi ${name.split(" ")[0]},`,
        "We received your message and will get back to you shortly — usually within a few hours.",
        "In the meantime, feel free to browse available cars.",
      ],
      action: { label: "Browse cars", href: "/seattle" },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
