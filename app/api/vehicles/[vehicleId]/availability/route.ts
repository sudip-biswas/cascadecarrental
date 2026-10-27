import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasConflict, unavailableRanges } from "@/lib/trips";
import { loadTripRules, tripRuleProblem } from "@/lib/trip-rules";
import { isDateKey, isTimeKey, DEFAULT_TIME } from "@/components/search/dates";
import { zonedInstant } from "@/lib/utils";

/**
 * Booked and blocked ranges for a car. With ?from=&until= (and optional
 * fromTime/untilTime) it also says whether that trip can be booked, and why not.
 */
export async function GET(req: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const query = new URL(req.url).searchParams;
  const from = query.get("from");
  const until = query.get("until");
  const unavailable = await unavailableRanges(vehicleId);
  if (!isDateKey(from) || !isDateKey(until)) return NextResponse.json({ unavailable });

  const fromTime = query.get("fromTime");
  const untilTime = query.get("untilTime");
  const start = zonedInstant(from, isTimeKey(fromTime) ? fromTime : DEFAULT_TIME);
  const end = zonedInstant(until, isTimeKey(untilTime) ? untilTime : DEFAULT_TIME);
  const rules = await loadTripRules(createAdminClient(), vehicleId);
  if (!rules) return NextResponse.json({ error: "No such car." }, { status: 404 });

  const problem =
    tripRuleProblem(rules, start, end) ??
    ((await hasConflict(vehicleId, start, end, rules.trip_buffer_hours)) ? "Some of those days are taken. Try other dates." : null);
  return NextResponse.json({ unavailable, available: !problem, problem });
}
