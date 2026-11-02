import { NextResponse } from "next/server";
import { processDueCharges } from "@/lib/charges";
import { sendReviewReminders, sendTripReminders, settleAllTrips } from "@/lib/trips";
import { sendDueScheduledMessages } from "@/lib/scheduled-messages";
import { refreshAutoPrices } from "@/lib/auto-pricing-refresh";
import { sendCheckReminders } from "@/lib/guest-checks";
import { refreshTopHosts } from "@/lib/top-host";

export const maxDuration = 60;

/**
 * Runs once a day (vercel.json). Moves every trip along, sends pick-up, return,
 * pre-trip check and rate-the-guest reminders, charges and releases whatever is
 * due, reprices cars on automatic pricing, then works out who is a top host.
 * Vercel sends `Authorization: Bearer $CRON_SECRET` on cron calls.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Each step runs even if the one before it failed.
  const run = async <T,>(name: string, step: () => Promise<T>) => {
    try {
      return await step();
    } catch (err) {
      console.error(`[cron] ${name} failed`, err);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  };

  const settled = await run("settle", settleAllTrips);
  const reminders = await run("reminders", sendTripReminders);
  const checks = await run("check reminders", sendCheckReminders);
  const reviews = await run("review reminders", () => sendReviewReminders());
  const charges = await run("charges", processDueCharges);
  const messages = await run("scheduled messages", () => sendDueScheduledMessages());
  const prices = await run("automatic prices", () => refreshAutoPrices());
  const topHosts = await run("top hosts", () => refreshTopHosts());

  return NextResponse.json({ settled, reminders, checks, reviews, charges: charges ?? "done", messages, prices, topHosts });
}
