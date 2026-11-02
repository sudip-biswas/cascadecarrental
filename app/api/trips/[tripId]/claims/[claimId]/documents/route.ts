import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CLAIM_PHOTOS_MAX, isOpenClaim, loadClaim } from "@/lib/claims";
import { UPLOAD_MAX_BYTES } from "@/lib/licence";
import { readPhotos, removePhotos, uploadPhotos } from "@/lib/trip-photos";

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/** The host adds photos of quotes or repairs to an open claim. */
export async function POST(req: Request, { params }: { params: Promise<{ tripId: string; claimId: string }> }) {
  const { tripId, claimId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Log in first.", 401);

  const found = await loadClaim(tripId, claimId);
  if (!found || (found.trip.host_id !== user.id && found.trip.guest_id !== user.id)) return fail("Claim not found.", 404);
  if (found.trip.host_id !== user.id) return fail("Only the host can do that.", 403);
  const { claim } = found;
  if (!isOpenClaim(claim)) return fail("This claim is closed.", 409);

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Something's off with this form. Refresh and try again.", 400);
  const photos = readPhotos(form);
  if (photos.error !== undefined) return fail(photos.error, 400);
  if (!photos.files.length) return fail("Add at least one photo.", 400);
  if (photos.files.reduce((sum, f) => sum + f.size, 0) > UPLOAD_MAX_BYTES) return fail("Those photos are too big together. Send fewer.", 413);
  if (claim.photos.length + photos.files.length > CLAIM_PHOTOS_MAX) return fail(`A claim can hold ${CLAIM_PHOTOS_MAX} photos.`, 400);

  const paths = await uploadPhotos(tripId, "claims", photos.files, photos.types);
  if (!paths) return fail("Upload failed. Try again.", 500);

  // Only if nobody else changed the list meanwhile.
  const { data } = await createAdminClient()
    .from("trip_claims")
    .update({ photos: [...claim.photos, ...paths], updated_at: new Date().toISOString() })
    .eq("id", claim.id)
    .eq("updated_at", claim.updated_at)
    .select("id")
    .maybeSingle();
  if (!data) {
    await removePhotos(paths);
    return fail("The claim just changed. Refresh and try again.", 409);
  }
  return NextResponse.json({ ok: true });
}
