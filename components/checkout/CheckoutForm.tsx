"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { Appearance } from "@stripe/stripe-js";
import { ArrowLeft, Clock, CreditCard, Lock, Shield } from "lucide-react";
import { getStripe } from "@/lib/stripe/client";
import {
  NON_REFUNDABLE_DISCOUNT,
  PROTECTION_DAILY_CENTS,
  computePricing,
  dayRates,
  tripDays,
  type DailyPrices,
  type PricingResult,
  type ProtectionPlan,
  type RateType,
} from "@/lib/pricing";
import { carPath } from "@/lib/site";
import { cn, formatCurrency, formatDateTime, formatPrice, formatRange, pluralize, zonedInstant } from "@/lib/utils";
import { Container, Divider, Fact, Tile, TileTitle } from "@/components/kit";
import { Button } from "@/components/ui/button";

export interface CheckoutVehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  location_name: string;
  daily_rate_cents: number;
  weekly_discount_pct: number;
  monthly_discount_pct: number;
  distance_included_mi: number;
  instant_book: boolean;
  vehicle_images: { url: string; is_cover: boolean; position: number }[];
  host: { full_name: string } | null;
}

interface Props {
  vehicle: CheckoutVehicle;
  from: string;
  until: string;
  initialRate: RateType;
  /** The host's own prices for the trip's days. */
  dailyPrices: DailyPrices;
}

const appearance: Appearance = {
  theme: "flat",
  variables: {
    fontFamily: "Geist, system-ui, sans-serif",
    fontSizeBase: "16px",
    colorPrimary: "#111111",
    colorText: "#111111",
    colorTextSecondary: "#4A4D55",
    colorTextPlaceholder: "#8A8E98",
    colorBackground: "#FFFFFF",
    colorDanger: "#B3261E",
    borderRadius: "14px",
    spacingUnit: "4px",
  },
  rules: {
    ".Input": { backgroundColor: "#F3F4F6", border: "none", padding: "14px 16px" },
    ".Input:focus": { backgroundColor: "#FFFFFF", boxShadow: "0 0 0 2px #111111" },
    ".Label": { fontWeight: "600", color: "#4A4D55" },
    ".Tab": { backgroundColor: "#F3F4F6", border: "none" },
    ".Tab--selected": { backgroundColor: "#111111", color: "#FFFFFF" },
  },
};

const fonts = [{ cssSrc: "https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700&display=swap" }];

const PLANS: { id: ProtectionPlan | null; name: string }[] = [
  { id: null, name: "No protection" },
  { id: "basic", name: "Basic" },
  { id: "standard", name: "Standard" },
  { id: "premium", name: "Premium" },
];

const RATES: { id: RateType; name: string; desc: string }[] = [
  {
    id: "non_refundable",
    name: `Pay now, save ${Math.round(NON_REFUNDABLE_DISCOUNT * 100)}%`,
    desc: "Free to cancel for 24 hours after it's confirmed. No refund after that.",
  },
  {
    id: "refundable",
    name: "Free cancellation until pick-up",
    desc: "Full price. Cancel any time before pick-up for a full refund.",
  },
];

function coverOf(vehicle: CheckoutVehicle) {
  const images = [...vehicle.vehicle_images].sort(
    (a, b) => Number(b.is_cover) - Number(a.is_cover) || a.position - b.position
  );
  return images[0]?.url ?? null;
}

export function CheckoutForm({ vehicle, from, until, initialRate, dailyPrices }: Props) {
  const [rateType, setRateType] = useState<RateType>(initialRate);
  const [plan, setPlan] = useState<ProtectionPlan | null>(null);

  const start = zonedInstant(from);
  const end = zonedInstant(until);
  const days = tripDays(start, end);
  const pricing = computePricing({
    dailyRateCents: vehicle.daily_rate_cents,
    days,
    dayRatesCents: dayRates(vehicle.daily_rate_cents, from, days, dailyPrices),
    protectionPlan: plan,
    rateType,
    weeklyDiscountPct: vehicle.weekly_discount_pct,
    monthlyDiscountPct: vehicle.monthly_discount_pct,
  });

  return (
    <Elements
      stripe={getStripe()}
      options={{
        mode: "payment",
        amount: pricing.totalCents,
        currency: "usd",
        captureMethod: vehicle.instant_book ? "automatic" : "manual",
        allowedPaymentMethodTypes: ["card"],
        appearance,
        fonts,
      }}
    >
      <CheckoutLayout
        vehicle={vehicle}
        from={from}
        until={until}
        start={start}
        end={end}
        pricing={pricing}
        rateType={rateType}
        onRateType={setRateType}
        plan={plan}
        onPlan={setPlan}
      />
    </Elements>
  );
}

function CheckoutLayout({
  vehicle,
  from,
  until,
  start,
  end,
  pricing,
  rateType,
  onRateType,
  plan,
  onPlan,
}: Omit<Props, "initialRate" | "dailyPrices"> & {
  start: Date;
  end: Date;
  pricing: PricingResult;
  rateType: RateType;
  onRateType: (rate: RateType) => void;
  plan: ProtectionPlan | null;
  onPlan: (plan: ProtectionPlan | null) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const hostName = vehicle.host?.full_name?.split(" ")[0] || "the host";
  const total = formatCurrency(pricing.totalCents);
  const cta = vehicle.instant_book ? `Book · ${total}` : `Request to book · ${total}`;
  const holdNote = vehicle.instant_book
    ? "Instant book: your card is charged now and the car is yours."
    : `Your card is held now and only charged if ${hostName} accepts. If they say no or don't answer, the hold is released.`;
  const cover = coverOf(vehicle);
  const carUrl = `${carPath(vehicle)}?from=${from}&until=${until}`;

  // The Payment Element needs to know the amount to offer the right payment methods.
  useEffect(() => {
    elements?.update({ amount: pricing.totalCents });
  }, [elements, pricing.totalCents]);

  async function pay() {
    if (!stripe || !elements || busy) return;
    setError(null);
    setBusy(true);

    const { error: cardError } = await elements.submit();
    if (cardError) {
      setError(cardError.message ?? "Check your card details.");
      setBusy(false);
      return;
    }

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId: vehicle.id,
        from,
        until,
        rateType,
        protectionPlan: plan,
        expectedTotalCents: pricing.totalCents,
        expectedInstantBook: vehicle.instant_book,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Couldn't start the booking. Try again.");
      // The price or dates moved: reload the car so the total is current.
      if (res.status === 409) router.refresh();
      setBusy(false);
      return;
    }

    const { tripId, clientSecret } = data as { tripId: string; clientSecret: string };
    const tripUrl = `/trips/${tripId}?booked=1`;
    const { error: payError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: `${window.location.origin}${tripUrl}` },
      redirect: "if_required",
    });
    if (payError) {
      setError(payError.message ?? "The payment didn't go through. Nothing was charged.");
      setBusy(false);
      return;
    }

    await fetch(`/api/trips/${tripId}/sync`, { method: "POST" }).catch(() => null);
    if (note.trim()) {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: note.trim(), tripId }),
      }).catch(() => null);
    }
    router.push(tripUrl);
  }

  const payButton = (
    <Button size="lg" className="h-[60px] w-full text-[18px]" disabled={!stripe || busy} onClick={pay}>
      {busy ? "Working on it…" : cta}
    </Button>
  );

  return (
    <div className="pb-40 lg:pb-16">
      <Container className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <Button asChild variant="outline" size="sm">
          <Link href={carUrl}>
            <ArrowLeft />
            Back to the {vehicle.model}
          </Link>
        </Button>
        <span className="flex items-center gap-2 text-sm font-semibold text-slate">
          <Lock className="size-[18px]" strokeWidth={1.75} />
          Payments by Stripe
        </span>
      </Container>

      <Container className="flex flex-wrap items-start gap-5 pt-5">
        <main className="flex min-w-0 flex-[999_1_600px] flex-col gap-3.5">
          <h1 className="headline mb-1.5 text-[clamp(40px,5.4vw,80px)]">Almost yours.</h1>

          <Tile tone="white" className="flex items-center gap-3.5 p-2 lg:hidden">
            {cover && (
              <Image src={cover} alt="" width={76} height={60} className="h-[60px] w-[76px] rounded-[15px] object-cover" />
            )}
            <span className="min-w-0">
              <span className="block truncate text-base font-extrabold">
                {vehicle.make} {vehicle.model}
                {vehicle.host ? ` · ${hostName}` : ""}
              </span>
              <span className="text-[13px] text-slate">{formatRange(start, end)} · 10:00</span>
            </span>
          </Tile>

          <Section icon={<Shield />} iconTone="bg-lilac" title="Protection">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-2">
              {PLANS.map((p) => {
                const perDay = p.id ? PROTECTION_DAILY_CENTS[p.id] : 0;
                return (
                  <Choice key={p.name} on={plan === p.id} onClick={() => onPlan(p.id)}>
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="text-[17px] font-extrabold">{p.name}</span>
                      <span className="figures text-[15px] font-bold">{p.id ? `${formatPrice(perDay)}/day` : "$0"}</span>
                    </span>
                    <span className="text-sm opacity-75">
                      {p.id
                        ? `${formatCurrency(perDay * pricing.days)} for this trip`
                        : "Your own insurance covers the car, or you do."}
                    </span>
                  </Choice>
                );
              })}
            </div>
          </Section>

          <Section icon={<Clock />} iconTone="bg-butter" title="How you pay">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-2">
              {RATES.map((r) => (
                <Choice key={r.id} on={rateType === r.id} onClick={() => onRateType(r.id)}>
                  <span className="text-[17px] font-extrabold">{r.name}</span>
                  <span className="text-sm opacity-75">{r.desc}</span>
                </Choice>
              ))}
            </div>
          </Section>

          <Section icon={<CreditCard />} iconTone="bg-sky" title="Card">
            <PaymentElement options={{ layout: "tabs" }} />
            <label className="flex flex-col gap-1.5 rounded-[16px] bg-board px-3.5 py-3">
              <span className="text-[13px] font-semibold text-slate">Note to {hostName} (optional)</span>
              <textarea
                rows={2}
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="When you land, where you'd like to meet…"
                className="w-full resize-none bg-transparent text-base outline-none placeholder:text-quiet"
              />
            </label>
          </Section>
        </main>

        <aside className="flex min-w-0 flex-[1_1_360px] flex-col gap-3.5 rounded-[30px] bg-white p-5 lg:sticky lg:top-4">
          <div className="hidden items-center gap-3.5 lg:flex">
            {cover && (
              <Image src={cover} alt="" width={108} height={84} className="h-[84px] w-[108px] rounded-[16px] object-cover" />
            )}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-display text-[24px] font-extrabold leading-tight">
                {vehicle.make} {vehicle.model}
              </span>
              <span className="text-sm text-slate">
                {[`${vehicle.year}${vehicle.trim ? ` ${vehicle.trim}` : ""}`, vehicle.host?.full_name, vehicle.location_name]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Fact label="Pick-up" value={formatDateTime(start)} />
            <Fact label="Return" value={formatDateTime(end)} />
          </div>

          <Breakdown pricing={pricing} plan={plan} />

          {error && (
            <p role="alert" className="rounded-[14px] bg-error-soft px-3.5 py-3 text-[15px] font-semibold text-error">
              {error}
            </p>
          )}

          <div className="hidden lg:block">{payButton}</div>
          <p className="flex gap-2.5 rounded-[18px] bg-sky p-3.5 text-sm leading-[1.45] text-sky-ink">
            <Clock className="size-5 shrink-0" strokeWidth={1.75} />
            <span>
              {holdNote} {pluralize(vehicle.distance_included_mi * pricing.days, "mile")} included.
            </span>
          </p>
        </aside>
      </Container>

      <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-2 rounded-t-[26px] bg-white px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))] lg:hidden">
        {payButton}
        <span className="text-center text-xs leading-snug text-slate">
          {vehicle.instant_book ? "You're charged now." : `Held now, charged only if ${hostName} accepts.`}
        </span>
      </div>
    </div>
  );
}

function Section({
  icon,
  iconTone,
  title,
  children,
}: {
  icon: ReactNode;
  iconTone: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Tile className="flex flex-col gap-4 sm:p-6">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-10 items-center justify-center rounded-[12px] [&_svg]:size-5", iconTone)}>
          {icon}
        </span>
        <TileTitle>{title}</TileTitle>
      </div>
      {children}
    </Tile>
  );
}

function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex min-h-[96px] flex-col items-start justify-between gap-2.5 rounded-[20px] p-4 text-left transition-colors",
        on ? "bg-ink text-white" : "bg-board text-ink hover:bg-line"
      )}
    >
      {children}
    </button>
  );
}

function Breakdown({ pricing, plan }: { pricing: PricingResult; plan: ProtectionPlan | null }) {
  const rows = [
    {
      label: pricing.ratesVary
        ? `${pluralize(pricing.days, "day")}, avg ${formatPrice(pricing.dailyRateCents)}`
        : `${pluralize(pricing.days, "day")} × ${formatPrice(pricing.dailyRateCents)}`,
      value: pricing.baseCents,
    },
    pricing.lengthDiscountCents > 0 && {
      label: `${pricing.days >= 30 ? "Monthly" : "Weekly"} discount, ${pricing.lengthDiscountPct}%`,
      value: -pricing.lengthDiscountCents,
    },
    pricing.savingsCents > 0 && {
      label: `Pay now, ${Math.round(NON_REFUNDABLE_DISCOUNT * 100)}% off`,
      value: -pricing.savingsCents,
    },
  ].filter((r) => r !== false);

  return (
    <div className="figures flex flex-col gap-2.5">
      <div className="flex h-3.5 gap-[3px] overflow-hidden rounded-[7px]" aria-hidden>
        <span className="bg-ink" style={{ flex: pricing.subtotalCents }} />
        {pricing.protectionCostCents > 0 && <span className="bg-lilac" style={{ flex: pricing.protectionCostCents }} />}
        <span className="bg-sky" style={{ flex: pricing.taxCents }} />
      </div>
      {rows.map((r) => (
        <Line key={r.label} swatch="bg-ink" label={r.label} value={r.value} />
      ))}
      <Line
        swatch="bg-lilac"
        label={plan ? `${plan[0].toUpperCase()}${plan.slice(1)} protection` : "No protection"}
        value={pricing.protectionCostCents}
      />
      <Line swatch="bg-sky" label="Tax, 10.9%" value={pricing.taxCents} />
      <Divider className="mt-1" />
      <div className="flex items-baseline justify-between">
        <span className="text-[17px] font-bold">Total</span>
        <span className="font-display text-[36px] font-extrabold tracking-[-0.02em]">
          {formatCurrency(pricing.totalCents)}
        </span>
      </div>
    </div>
  );
}

function Line({ swatch, label, value }: { swatch: string; label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3 text-[15px]">
      <span className="flex items-center gap-2">
        <span className={cn("size-2.5 shrink-0 rounded-[3px]", swatch)} />
        {label}
      </span>
      <span>{value < 0 ? `−${formatCurrency(-value)}` : formatCurrency(value)}</span>
    </div>
  );
}
