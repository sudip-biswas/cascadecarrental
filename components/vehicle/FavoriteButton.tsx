"use client";

import { useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// The same car can show twice on a page (the map card and the list), so every
// heart for a car reads the latest choice from here.
const choices = new Map<string, boolean>();
const listeners = new Set<() => void>();

function choose(key: string, saved: boolean) {
  choices.set(key, saved);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Heart that saves a car to the guest's favorites. Flips straight away and
 * rolls back if the save fails. Signed-out guests go to log in first.
 */
export function FavoriteButton({
  vehicleId,
  userId,
  saved: initial,
  size = "md",
  className,
}: {
  vehicleId: string;
  userId: string | null;
  saved: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const key = `${userId}:${vehicleId}`;
  const saved = useSyncExternalStore(
    subscribe,
    () => choices.get(key) ?? initial,
    () => initial
  );
  const busy = useRef(false);

  async function toggle() {
    if (!userId) {
      const here = `${window.location.pathname}${window.location.search}`;
      router.push(`/login?redirectTo=${encodeURIComponent(here)}`);
      return;
    }
    if (busy.current) return;
    busy.current = true;

    const next = !saved;
    choose(key, next);
    const favorites = createClient().from("favorites");
    const { error } = next
      ? await favorites.upsert({ user_id: userId, vehicle_id: vehicleId }, { ignoreDuplicates: true })
      : await favorites.delete().eq("user_id", userId).eq("vehicle_id", vehicleId);
    busy.current = false;

    if (error) {
      choose(key, !next);
      toast.error("Couldn't save that. Try again.");
    }
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "Remove from favorites" : "Save to favorites"}
      title={saved ? "Saved" : "Save"}
      onClick={toggle}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-white text-ink transition-colors outline-none hover:bg-board focus-visible:ring-2 focus-visible:ring-cobalt",
        size === "sm" ? "size-8" : size === "lg" ? "size-12" : "size-10",
        className
      )}
    >
      <Heart
        className={cn(size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-5", saved && "fill-error text-error")}
        strokeWidth={2.25}
      />
    </button>
  );
}
