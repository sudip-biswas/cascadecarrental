import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const plate = searchParams.get("plate")?.trim().toUpperCase();
  if (!plate) return NextResponse.json({ ok: true });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: true });

  // Plates are a private column, readable only with the admin client.
  const { data } = await createAdminClient()
    .from("vehicles")
    .select("id")
    .eq("license_plate", plate)
    .eq("host_id", user.id)
    .maybeSingle();

  if (data) {
    return NextResponse.json(
      { error: "You already have a car with this plate" },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
