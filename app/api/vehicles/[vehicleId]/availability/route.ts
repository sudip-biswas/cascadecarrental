import { NextResponse } from "next/server";
import { unavailableRanges } from "@/lib/trips";

export async function GET(_req: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  return NextResponse.json({ unavailable: await unavailableRanges(vehicleId) });
}
