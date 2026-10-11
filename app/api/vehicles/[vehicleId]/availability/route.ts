import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ vehicleId: string }> }
) {
  const { vehicleId } = await params;
  const supabase = await createClient();

  const [{ data: trips }, { data: blocked }] = await Promise.all([
    supabase
      .from("trips")
      .select("starts_at, ends_at")
      .eq("vehicle_id", vehicleId)
      .not("status", "in", '("cancelled_guest","cancelled_host")'),
    supabase
      .from("vehicle_availability")
      .select("blocked_from, blocked_to")
      .eq("vehicle_id", vehicleId),
  ]);

  const unavailable = [
    ...(trips ?? []).map((t) => ({ from: t.starts_at, to: t.ends_at })),
    ...(blocked ?? []).map((b) => ({ from: b.blocked_from, to: b.blocked_to })),
  ];

  return NextResponse.json({ unavailable });
}
