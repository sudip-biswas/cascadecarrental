import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export async function HostTopbar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  return (
    <header className="h-14 border-b border-border bg-white flex items-center justify-between px-4 sm:px-6 shrink-0">
      <Logo size="sm" />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild className="text-cascade-700 font-medium">
          <Link href="/">Switch to guest</Link>
        </Button>

        <Button size="sm" asChild className="bg-cascade-700 hover:bg-cascade-900 text-white">
          <Link href="/host/vehicles/new">List your car</Link>
        </Button>

        <Avatar className="w-8 h-8">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs bg-cascade-100 text-cascade-700 font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
