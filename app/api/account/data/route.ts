import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadAccountData } from "@/lib/account-data";
import { toDateKey } from "@/lib/utils";

/** The signed-in person's own data, as a JSON file. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log in to download your data." }, { status: 401 });

  try {
    const data = await loadAccountData(user);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="cascade-data-${toDateKey(new Date())}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[account] data download failed", user.id, err);
    return NextResponse.json({ error: "Couldn't build your download. Try again." }, { status: 500 });
  }
}
