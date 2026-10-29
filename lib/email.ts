import { SITE_URL } from "@/lib/site";

export interface Email {
  to: string;
  subject: string;
  /** Plain sentences, one per line. The HTML version is built from these. */
  lines: string[];
  action?: { label: string; href: string };
}

const FROM = process.env.EMAIL_FROM ?? "Cascade <trips@cascadecarrental.com>";

function escape(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function absolute(href: string) {
  return href.startsWith("http") ? href : `${SITE_URL}${href}`;
}

function html(email: Email) {
  const action = email.action
    ? `<p style="margin:28px 0 8px"><a href="${absolute(email.action.href)}" style="background:#111;color:#fff;padding:14px 22px;border-radius:14px;text-decoration:none;font-weight:700;display:inline-block">${escape(email.action.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Geist,system-ui,sans-serif;color:#111">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="font-weight:800;font-size:20px;margin:0 0 24px">Cascade</p>
<div style="background:#fff;border-radius:24px;padding:28px">
<h1 style="font-size:24px;line-height:1.2;margin:0 0 16px">${escape(email.subject)}</h1>
${email.lines.map((l) => `<p style="font-size:16px;line-height:1.5;margin:0 0 10px">${escape(l)}</p>`).join("")}
${action}
</div>
<p style="font-size:13px;color:#4a4d55;margin:20px 4px">Car rental in Seattle. You're getting this because of a trip on Cascade.</p>
</div></body></html>`;
}

function text(email: Email) {
  return [...email.lines, ...(email.action ? ["", `${email.action.label}: ${absolute(email.action.href)}`] : [])].join("\n");
}

/**
 * Sends one email. Resend when RESEND_API_KEY is set, the local Mailpit inbox
 * when MAILPIT_URL is, and otherwise only logs it. Never throws: a lost email
 * mustn't undo a booking.
 */
export async function sendEmail(email: Email): Promise<boolean> {
  try {
    if (process.env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: email.to, subject: email.subject, html: html(email), text: text(email) }),
      });
      return res.ok;
    }
    if (process.env.MAILPIT_URL) {
      const [, name = "Cascade", address = FROM] = FROM.match(/^(.*?)\s*<(.+)>$/) ?? [];
      const res = await fetch(`${process.env.MAILPIT_URL}/api/v1/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          From: { Email: address, Name: name },
          To: [{ Email: email.to }],
          Subject: email.subject,
          HTML: html(email),
          Text: text(email),
        }),
      });
      return res.ok;
    }
    // In production a missing key means nobody gets email, so say so where errors are watched.
    if (process.env.VERCEL_ENV === "production") console.error(`[email] RESEND_API_KEY isn't set, so "${email.subject}" wasn't emailed`);
    else console.info(`[email] ${email.to}: ${email.subject}`);
    return false;
  } catch (err) {
    console.error("[email] failed", err);
    return false;
  }
}
