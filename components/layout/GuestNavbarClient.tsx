"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, Car } from "lucide-react";
import type { User } from "@supabase/supabase-js";

interface Props {
  user: User | null;
  profile: { full_name: string; avatar_url: string | null; is_host: boolean } | null;
}

export function GuestNavbarClient({ user, profile }: Props) {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  async function handleSwitchToHost() {
    if (!user) {
      router.push("/login?redirectTo=/host/vehicles");
      return;
    }
    if (!profile?.is_host) {
      router.push("/host/vehicles/new");
      return;
    }
    router.push("/host/vehicles");
  }

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  return (
    <div className="flex items-center gap-3">
      {user ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSwitchToHost}
            className="hidden sm:flex text-cascade-700 hover:text-cascade-900 font-medium"
          >
            Switch to hosting
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 border border-border rounded-full px-3 py-1.5 hover:shadow-md transition-shadow">
                <Menu className="w-4 h-4 text-muted-foreground" />
                <Avatar className="w-7 h-7">
                  <AvatarImage src={profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs bg-cascade-100 text-cascade-700 font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-cascade-900">
                  {profile?.full_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/trips">My trips</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/messages">Messages</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSwitchToHost}>
                <Car className="w-4 h-4 mr-2" />
                Switch to hosting
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-cascade-700 hover:text-cascade-900 font-medium"
          >
            <Link href="/login">Sign in</Link>
          </Button>
          <Button
            size="sm"
            asChild
            className="bg-cascade-700 hover:bg-cascade-900 text-white hidden sm:flex"
          >
            <Link href="/register">Sign up</Link>
          </Button>
        </>
      )}
    </div>
  );
}
