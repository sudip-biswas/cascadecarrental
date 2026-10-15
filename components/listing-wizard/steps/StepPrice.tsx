"use client";

import { Minus, Plus } from "lucide-react";
import { Divider, PriceRow, Tile, TileTitle } from "@/components/kit";
import { HOST_SHARE, hostEarningsCents } from "@/lib/pricing";
import { cn, formatCurrency, formatPrice } from "@/lib/utils";
import type { Errors, WizardData } from "../data";
import { LIMITS } from "@/lib/listing-limits";
import { suggestDailyRate } from "@/lib/suggested-rate";

interface Props {
  data: WizardData;
  errors: Errors;
  onChange: (updates: Partial<WizardData>) => void;
}

const digits = (raw: string) => Number(raw.replace(/\D/g, "").slice(0, 6)) || 0;

export function StepPrice({ data, errors, onChange }: Props) {
  const rate = data.dailyRateCents;
  const suggested = suggestDailyRate(data.vehicleType, data.year);
  const isSuggested = rate === suggested;

  const step = (delta: number) =>
    onChange({
      dailyRateCents: Math.min(LIMITS.rateMaxCents, Math.max(LIMITS.rateMinCents, Math.round(rate / 100) * 100 + delta)),
    });
  const afterDiscount = (pct: number) =>
    pct > 0 ? `${formatPrice(Math.round((rate * (100 - pct)) / 100))}/day after discount` : "No discount";

  return (
    <>
      <Tile className={cn("flex flex-col gap-2", errors.dailyRateCents && "bg-error-soft")}>
        <div className="flex items-center gap-3.5">
          <StepButton label="Lower price" onClick={() => step(-100)} disabled={rate <= LIMITS.rateMinCents}>
            <Minus className="size-6" strokeWidth={2.5} />
          </StepButton>
          <label className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <span className="flex items-baseline justify-center font-display text-[64px] leading-none font-extrabold tracking-[-0.035em] sm:text-[96px]">
              $
              <input
                aria-label="Daily price in dollars"
                inputMode="numeric"
                value={rate ? rate / 100 : ""}
                onChange={(e) => onChange({ dailyRateCents: digits(e.target.value) * 100 })}
                style={{ width: `${Math.max(2, String(rate / 100).length)}ch` }}
                className="figures bg-transparent p-0 text-center outline-none"
              />
            </span>
            <span className="text-[15px] font-semibold text-slate">per day</span>
          </label>
          <StepButton label="Raise price" onClick={() => step(100)} disabled={rate >= LIMITS.rateMaxCents}>
            <Plus className="size-6" strokeWidth={2.5} />
          </StepButton>
        </div>
        {errors.dailyRateCents && (
          <p className="text-center text-[13px] font-semibold text-error">{errors.dailyRateCents}</p>
        )}
        {isSuggested ? (
          <p className="text-center text-[13px] text-slate">
            Suggested for your {data.vehicleType} — adjust anytime
          </p>
        ) : (
          <p className="text-center text-[13px] text-slate">
            Suggested for your {data.vehicleType}:{" "}
            <button
              type="button"
              onClick={() => onChange({ dailyRateCents: suggested })}
              className="font-semibold text-ink underline underline-offset-2"
            >
              {formatPrice(suggested)}/day
            </button>
          </p>
        )}
      </Tile>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <Tile className="flex flex-col gap-2.5">
          <TileTitle className="mb-1">Longer trips</TileTitle>
          <Row label="7+ days" hint={afterDiscount(data.weeklyDiscountPct)} error={errors.weeklyDiscountPct}>
            <PillInput
              label="Discount for 7 or more days"
              value={data.weeklyDiscountPct}
              suffix="% off"
              onChange={(v) => onChange({ weeklyDiscountPct: Math.min(v, LIMITS.discountMaxPct) })}
            />
          </Row>
          <Row label="30+ days" hint={afterDiscount(data.monthlyDiscountPct)} error={errors.monthlyDiscountPct}>
            <PillInput
              label="Discount for 30 or more days"
              value={data.monthlyDiscountPct}
              suffix="% off"
              onChange={(v) => onChange({ monthlyDiscountPct: Math.min(v, LIMITS.discountMaxPct) })}
            />
          </Row>
        </Tile>
        <Tile className="flex flex-col gap-2.5">
          <TileTitle className="mb-1">Miles</TileTitle>
          <Row label="Included per day" error={errors.distanceIncludedMi}>
            <PillInput
              label="Miles included per day"
              value={data.distanceIncludedMi}
              suffix="mi"
              onChange={(v) => onChange({ distanceIncludedMi: Math.min(v, LIMITS.milesMax) })}
            />
          </Row>
          <Row label="Each extra mile" error={errors.extraMileFeeCents}>
            <PillInput
              label="Price per extra mile in cents"
              value={data.extraMileFeeCents}
              suffix="¢"
              onChange={(v) => onChange({ extraMileFeeCents: Math.min(v, LIMITS.extraMileMaxCents) })}
            />
          </Row>
        </Tile>
      </div>
    </>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-board transition-colors hover:bg-line disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Row({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-2xl px-3.5 py-3", error ? "bg-error-soft" : "bg-board")}>
      <span className="flex flex-col gap-0.5">
        <span className="text-base font-bold">{label}</span>
        {(error || hint) && (
          <span className={cn("text-[13px]", error ? "font-semibold text-error" : "text-slate")}>{error ?? hint}</span>
        )}
      </span>
      {children}
    </div>
  );
}

function PillInput({
  value,
  onChange,
  suffix,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  suffix: string;
  label: string;
}) {
  return (
    <label className="flex h-10 shrink-0 items-center gap-1 rounded-[10px] bg-white px-2.5 text-[17px] font-extrabold focus-within:ring-2 focus-within:ring-ink">
      <input
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(digits(e.target.value))}
        style={{ width: `${Math.max(1, String(value).length) + 0.5}ch` }}
        className="figures bg-transparent p-0 text-right outline-none"
      />
      <span className="font-semibold text-slate">{suffix}</span>
    </label>
  );
}

/** "A 3-day trip, for example": what the host keeps at this price. */
export function PriceExample({ dailyRateCents }: { dailyRateCents: number }) {
  const days = 3;
  const subtotal = dailyRateCents * days;
  const earn = hostEarningsCents(subtotal);
  return (
    <div className="figures flex flex-col gap-2 rounded-[24px] bg-butter p-[18px] text-ink">
      <span className="text-sm font-bold text-butter-ink">A {days}-day trip, for example</span>
      <PriceRow label={`${days} days × ${formatPrice(dailyRateCents)}`} value={formatCurrency(subtotal)} />
      <PriceRow label={`Cascade fee (${Math.round((1 - HOST_SHARE) * 100)}%)`} value={`−${formatCurrency(subtotal - earn)}`} />
      <Divider />
      <PriceRow label="You earn" value={formatCurrency(earn)} strong />
      <span className="text-[13px] text-butter-ink">
        Guests who pay up front get 9% off, and that comes off the trip price too.
      </span>
    </div>
  );
}
