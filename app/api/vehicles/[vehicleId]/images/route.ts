import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LIMITS } from "@/lib/listing-limits";

const reorderSchema = z.object({ order: z.array(z.string().uuid()).min(1) });

/** Saves a new photo order. Body: { order: string[] } — image IDs in desired order. */
export async function PATCH(req: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = reorderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid order" }, { status: 400 });

  const { data: car } = await supabase
    .from("vehicles")
    .select("host_id")
    .eq("id", vehicleId)
    .single();
  if (!car || car.host_id !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  for (const [position, id] of parsed.data.order.entries()) {
    const { error } = await supabase
      .from("vehicle_images")
      .update({ position, is_cover: position === 0 })
      .eq("id", id)
      .eq("vehicle_id", vehicleId);
    if (error) return NextResponse.json({ error: "Couldn't save order." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/vehicle-images/`;

const schema = z.object({ url: z.string().url() });

/** Adds a photo uploaded through /api/uploads to one of the host's cars. */
export async function POST(req: Request, { params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !parsed.data.url.startsWith(`${STORAGE_PREFIX}${user.id}/`)) {
    return NextResponse.json({ error: "Upload the photo from this page." }, { status: 400 });
  }

  const { data: car } = await supabase
    .from("vehicles")
    .select("host_id, vehicle_images(position)")
    .eq("id", vehicleId)
    .single();
  if (!car || car.host_id !== user.id) {
    return NextResponse.json({ error: "Car not found" }, { status: 404 });
  }
  if (car.vehicle_images.length >= LIMITS.photosMax) {
    return NextResponse.json({ error: `A car can have up to ${LIMITS.photosMax} photos.` }, { status: 400 });
  }

  const position = Math.max(-1, ...car.vehicle_images.map((img) => img.position)) + 1;
  const { error } = await supabase.from("vehicle_images").insert({
    vehicle_id: vehicleId,
    url: parsed.data.url,
    storage_path: parsed.data.url.slice(STORAGE_PREFIX.length),
    position,
    is_cover: car.vehicle_images.length === 0,
  });
  if (error) return NextResponse.json({ error: "Couldn't save the photo." }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 201 });
}
