import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Deletes one photo from a car (DB row + storage object). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ vehicleId: string; imageId: string }> }
) {
  const { vehicleId, imageId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Confirm the image belongs to the host's car
  const { data: img } = await supabase
    .from("vehicle_images")
    .select("id, storage_path, vehicle_id, vehicles!inner(host_id)")
    .eq("id", imageId)
    .eq("vehicle_id", vehicleId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!img || (img.vehicles as any)?.host_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete DB row first
  const { error: dbErr } = await supabase.from("vehicle_images").delete().eq("id", imageId);
  if (dbErr) return NextResponse.json({ error: "Couldn't delete photo." }, { status: 500 });

  // Best-effort storage cleanup
  if (img.storage_path) {
    await createAdminClient().storage.from("vehicle-images").remove([img.storage_path]);
  }

  // Re-number remaining photos so positions stay gapless
  const { data: remaining } = await supabase
    .from("vehicle_images")
    .select("id, position")
    .eq("vehicle_id", vehicleId)
    .order("position");

  if (remaining?.length) {
    for (const [i, r] of remaining.entries()) {
      await supabase
        .from("vehicle_images")
        .update({ position: i, is_cover: i === 0 })
        .eq("id", r.id);
    }
  }

  return NextResponse.json({ ok: true });
}
