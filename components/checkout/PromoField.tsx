"use client";

import { useState } from "react";
import { TicketPercent, X } from "lucide-react";
import type { PromoTerms } from "@/lib/pricing";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type AppliedPromo = PromoTerms & { description: string | null };

/** "Promo code" with Apply. The server checks it again at booking. */
export function PromoField({
  trip,
  promo,
  onPromo,
}: {
  trip: { vehicleId: string; from: string; until: string; fromTime: string; untilTime: string };
  promo: AppliedPromo | null;
  onPromo: (promo: AppliedPromo | null) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (promo) {
    const off = promo.percentOff ? `${promo.percentOff}% off the rental` : `${formatPrice(promo.amountOffCents ?? 0)} off`;
    return (
      <div className="flex items-center justify-between gap-3 rounded-[16px] bg-mint px-3.5 py-2.5 text-mint-ink">
        <span className="flex min-w-0 items-center gap-2 text-[15px]">
          <TicketPercent className="size-[18px] shrink-0" strokeWidth={1.75} />
          <span className="truncate">
            <span className="font-extrabold">{promo.code}</span> · {promo.description || off}
          </span>
        </span>
        <Button type="button" variant="ghost" size="icon-xs" aria-label="Remove code" onClick={() => onPromo(null)}>
          <X />
        </Button>
      </div>
    );
  }

  async function apply() {
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...trip, code: code.trim() }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(data?.error ?? "Couldn't check that code. Try again.");
      return;
    }
    setCode("");
    onPromo(data as AppliedPromo);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Promo code"
          aria-label="Promo code"
          aria-invalid={!!error}
          maxLength={24}
          autoCapitalize="characters"
          className="h-11"
        />
        <Button type="submit" variant="secondary" className="h-11" disabled={busy || !code.trim()}>
          {busy ? "Checking…" : "Apply"}
        </Button>
      </form>
      {error && (
        <p role="alert" className="text-sm font-semibold text-error">
          {error}
        </p>
      )}
    </div>
  );
}
