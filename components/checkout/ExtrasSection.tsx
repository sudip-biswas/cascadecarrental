"use client";

import { Minus, Plus, PackagePlus } from "lucide-react";
import { cn, formatCurrency, formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { VehicleExtra } from "@/lib/supabase/types";
import { Section } from "./parts";

export type CheckoutExtra = Pick<
  VehicleExtra,
  "id" | "name" | "description" | "per" | "price_cents" | "max_quantity" | "unlimited_miles"
>;

/** Extras the host offers. One-off extras toggle; the rest get a count. */
export function ExtrasSection({
  extras,
  quantities,
  days,
  onChange,
}: {
  extras: CheckoutExtra[];
  quantities: Record<string, number>;
  days: number;
  onChange: (id: string, quantity: number) => void;
}) {
  if (extras.length === 0) return null;
  return (
    <Section icon={<PackagePlus />} iconTone="bg-butter" title="Extras">
      <div className="flex flex-col gap-2">
        {extras.map((extra) => {
          const quantity = quantities[extra.id] ?? 0;
          const forTrip = extra.price_cents * (extra.per === "day" ? days : 1);
          return (
            <div
              key={extra.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 rounded-[20px] p-4 transition-colors",
                quantity > 0 ? "bg-butter text-butter-ink" : "bg-board"
              )}
            >
              <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-0.5">
                <span className="text-[17px] font-extrabold">{extra.name}</span>
                <span className="figures text-sm opacity-75">
                  {extra.per === "day"
                    ? `${formatPrice(extra.price_cents)}/day, ${formatCurrency(forTrip)} for this trip`
                    : `${formatPrice(extra.price_cents)} per trip`}
                  {extra.description ? `. ${extra.description}` : ""}
                </span>
              </span>
              {extra.max_quantity > 1 ? (
                <span className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`One less ${extra.name}`}
                    disabled={quantity === 0}
                    onClick={() => onChange(extra.id, quantity - 1)}
                  >
                    <Minus />
                  </Button>
                  <span className="figures w-6 text-center text-[17px] font-extrabold" aria-live="polite">
                    {quantity}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label={`One more ${extra.name}`}
                    disabled={quantity >= extra.max_quantity}
                    onClick={() => onChange(extra.id, quantity + 1)}
                  >
                    <Plus />
                  </Button>
                </span>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant={quantity > 0 ? "default" : "outline"}
                  aria-pressed={quantity > 0}
                  onClick={() => onChange(extra.id, quantity > 0 ? 0 : 1)}
                >
                  {quantity > 0 ? "Added" : "Add"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
