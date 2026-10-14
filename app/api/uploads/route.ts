import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITS } from "@/lib/listing-limits";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to upload photos." }, { status: 401 });

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No photo attached." }, { status: 400 });
  }

  const ext = EXTENSIONS[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Photos have to be JPG, PNG or WebP." }, { status: 400 });
  }
  if (file.size > LIMITS.photoMaxBytes) {
    return NextResponse.json({ error: "Each photo has to be under 10 MB." }, { status: 400 });
  }

  // Files go in a folder named after the host, which is what the listing route checks.
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const storage = createAdminClient().storage.from("vehicle-images");
  const { data, error } = await storage.upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    return NextResponse.json({ error: "Upload failed. Try again." }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = storage.getPublicUrl(data.path);
  return NextResponse.json({ url: publicUrl, path: data.path });
}
