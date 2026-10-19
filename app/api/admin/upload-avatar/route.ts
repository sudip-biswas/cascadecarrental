import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** POST — upload a persona avatar using the service-role client (bypasses storage RLS). */
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== process.env.ADMIN_USER_ID) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const personaId = form.get("personaId") as string | null;
  if (!file || !personaId) {
    return NextResponse.json({ error: "Missing file or personaId" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${personaId}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from("persona-avatars")
    .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });

  if (error) {
    console.error("[upload-avatar]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: { publicUrl } } = admin.storage.from("persona-avatars").getPublicUrl(path);
  return NextResponse.json({ url: publicUrl });
}
