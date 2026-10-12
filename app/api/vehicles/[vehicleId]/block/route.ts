import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  blocked_from: z.string().datetime(),
  blocked_to: z.string().datetime(),
  reason: z.string().max(200).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ vehicleId: string }> }
) {
  const { vehicleId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, host_id")
    .eq("id", vehicleId)
    .single();

  if (!vehicle || vehicle.host_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { data: block, error } = await supabase
    .from("vehicle_availability")
    .insert({
      vehicle_id: vehicleId,
      blocked_from: parsed.data.blocked_from,
      blocked_to: parsed.data.blocked_to,
      reason: parsed.data.reason ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: "Failed to create block" }, { status: 500 });
  }

  return NextResponse.json({ id: block.id }, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ vehicleId: string }> }
) {
  const { vehicleId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const blockId = searchParams.get("blockId");
  if (!blockId) return NextResponse.json({ error: "blockId required" }, { status: 400 });

  // Verify ownership via join
  const { data: block } = await supabase
    .from("vehicle_availability")
    .select("id, vehicles!inner(host_id)")
    .eq("id", blockId)
    .eq("vehicle_id", vehicleId)
    .single();

  const blockAny = block as any;
  if (!block || blockAny.vehicles?.host_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("vehicle_availability")
    .delete()
    .eq("id", blockId);

  if (error) {
    return NextResponse.json({ error: "Failed to delete block" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
