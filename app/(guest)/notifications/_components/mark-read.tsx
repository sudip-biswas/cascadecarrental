"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Marks notifications read once the page has actually been seen (not on a
 * prefetch), then refreshes so the badge in the nav clears. The pages keep
 * anything read in the last few minutes looking new, so nothing flickers.
 */
export function MarkRead({ ids }: { ids?: string[] }) {
  const router = useRouter();
  const key = ids?.join(",") ?? "all";

  useEffect(() => {
    if (ids && ids.length === 0) return;
    fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
    })
      .then((res) => {
        if (res.ok) router.refresh();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
