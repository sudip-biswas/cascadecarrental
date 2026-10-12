import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  // Verify auth with anon client
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }

  const fileExt = file.name.split(".").pop() ?? "jpg";
  const fileName = `${user.id}/${Date.now()}.${fileExt}`;

  // Use service role to bypass storage bucket RLS
  const serviceClient = await createServiceClient();
  const { data, error } = await serviceClient.storage
    .from("vehicle-images")
    .upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: { publicUrl } } = serviceClient.storage
    .from("vehicle-images")
    .getPublicUrl(data.path);

  return NextResponse.json({ url: publicUrl, path: data.path });
}
