"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { SavedCard } from "@/lib/cards";
import { Button } from "@/components/ui/button";

const BRANDS: Record<string, string> = {
  amex: "American Express",
  diners: "Diners Club",
  discover: "Discover",
  jcb: "JCB",
  mastercard: "Mastercard",
  unionpay: "UnionPay",
  visa: "Visa",
};

const twoDigits = (n: number) => String(n).padStart(2, "0");

/** The cards saved on the person's Stripe customer, each with Remove. */
export function PaymentMethods() {
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [refused, setRefused] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    let current = true;
    fetch("/api/account/cards")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { cards: SavedCard[] }) => {
        if (current) setCards(body.cards);
      })
      .catch(() => {
        if (current) setLoadFailed(true);
      });
    return () => {
      current = false;
    };
  }, []);

  async function remove(id: string) {
    setRemoving(id);
    setRefused(null);
    const res = await fetch(`/api/account/cards?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    setRemoving(null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setRefused({ id, message: body?.error ?? "Couldn't remove that card. Try again." });
      return;
    }
    setCards((list) => list?.filter((c) => c.id !== id) ?? null);
    toast.success("Card removed.");
  }

  if (loadFailed) return <p className="text-[15px] text-slate">Couldn&apos;t load your cards.</p>;
  if (!cards) return <p className="text-[15px] text-slate">Loading…</p>;
  if (cards.length === 0) return <p className="text-[15px] text-slate">No saved cards.</p>;

  return (
    <ul className="flex flex-col gap-2.5">
      {cards.map((card) => (
        <li key={card.id} className="flex flex-col gap-2 rounded-[18px] bg-board px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold">
                {BRANDS[card.brand] ?? "Card"} ending {card.last4}
              </span>
              <span className="figures block text-[14px] text-slate">
                Expires {twoDigits(card.expMonth)}/{String(card.expYear).slice(-2)}
              </span>
            </span>
            <Button variant="outline" size="sm" disabled={removing === card.id} onClick={() => remove(card.id)}>
              {removing === card.id ? "Removing…" : "Remove"}
            </Button>
          </div>
          {refused?.id === card.id && (
            <p role="alert" className="text-[14px] font-semibold text-error">
              {refused.message}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
