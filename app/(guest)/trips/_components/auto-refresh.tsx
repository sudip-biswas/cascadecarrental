"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-checks a trip a few times while Stripe confirms the payment. */
export function AutoRefresh({ every = 3000, times = 5 }: { every?: number; times?: number }) {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    const id = setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= times) clearInterval(id);
    }, every);
    return () => clearInterval(id);
  }, [router, every, times]);
  return null;
}
