import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MESSAGE_PHOTO_BUCKET, MESSAGE_PHOTO_LIMITS, MESSAGE_PHOTO_TYPES } from "@/lib/message-photos";

/** Some phones send HEIC with no type, so fall back to the file name. */
const NAME_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" };

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * Uploads one photo for a message, into the sender's folder of the private
 * bucket. The message itself is sent after, with the path this returns.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Log in to send photos.", 401);

  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File) || file.size === 0) return fail("No photo attached.", 400);

  const type = MESSAGE_PHOTO_TYPES[file.type] ? file.type : NAME_TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""];
  if (!type) return fail("Photos have to be JPG, PNG, WebP or HEIC.", 400);
  if (file.size > MESSAGE_PHOTO_LIMITS.photoMaxBytes) return fail("Each photo has to be under 10 MB.", 400);

  const path = `${user.id}/${crypto.randomUUID()}.${MESSAGE_PHOTO_TYPES[type]}`;
  const { error } = await createAdminClient()
    .storage.from(MESSAGE_PHOTO_BUCKET)
    .upload(path, file, { contentType: type, upsert: false });
  if (error) return fail("Upload failed. Try again.", 500);

  return NextResponse.json({ path });
}
