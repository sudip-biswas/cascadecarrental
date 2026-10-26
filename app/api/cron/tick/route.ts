import { NextResponse } from "next/server";
import { processDueCharges } from "@/lib/charges";
import { sendTripReminders, settleAllTrips } from "@/lib/trips";

export const maxDuration = 60;

/**
 * Runs every 15 minutes (vercel.json). Moves every trip along, sends pick-up
 * and return reminders, then charges and releases whatever is due. Vercel
 * sends `Authorization: Bearer $CRON_SECRET` on cron calls.
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
  const charges = await run("charges", processDueCharges);

  return NextResponse.json({ settled, reminders, charges: charges ?? "done" });
}
