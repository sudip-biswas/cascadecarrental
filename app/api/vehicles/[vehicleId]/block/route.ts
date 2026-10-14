import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const createSchema = z
  .object({
    blocked_from: z.string().datetime({ offset: true }),
    blocked_to: z.string().datetime({ offset: true }),
    reason: z.string().trim().max(200).optional(),
  })
  .refine((b) => new Date(b.blocked_to) > new Date(b.blocked_from), {
    message: "The end has to be after the start",
  });

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** Only the car's host may block or unblock its dates. RLS enforces the same. */
async function ownCar(vehicleId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, error: fail("Unauthorized", 401) };

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("host_id", user.id)
    .maybeSingle();
  if (!vehicle) return { supabase, error: fail("Forbidden", 403) };
  return { supabase, error: null };
}

export async function POST(req: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const { supabase, error: denied } = await ownCar(vehicleId);
  if (denied) return denied;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Pick a start and end date.", 400);
  const { blocked_from, blocked_to, reason } = parsed.data;

  // Blocking can't take dates away from a guest who already has them.
  const { data: trips } = await supabase
    .from("trips")
    .select("id")
    .eq("vehicle_id", vehicleId)
    .in("status", ["pending", "approved", "active"])
    .lt("starts_at", blocked_to)
    .gt("ends_at", blocked_from)
    .limit(1);
  if (trips?.length) return fail("A guest has the car on some of those days. Pick other days.", 409);

  const { data: block, error } = await supabase
    .from("vehicle_availability")
    .insert({ vehicle_id: vehicleId, blocked_from, blocked_to, reason: reason || null })
    .select("id")
    .single();
  if (error) return fail("Failed to block those days.", 500);

  return NextResponse.json({ id: block.id }, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const { supabase, error: denied } = await ownCar(vehicleId);
  if (denied) return denied;

  const blockId = new URL(req.url).searchParams.get("blockId");
  if (!blockId) return fail("blockId required", 400);

  const { data, error } = await supabase
    .from("vehicle_availability")
    .delete()
    .eq("id", blockId)
    .eq("vehicle_id", vehicleId)
    .select("id");
  if (error) return fail("Failed to unblock those days.", 500);
  if (!data.length) return fail("That block is already gone.", 404);

  return NextResponse.json({ success: true });
}
