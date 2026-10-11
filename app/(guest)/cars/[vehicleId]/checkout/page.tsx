"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { differenceInDays } from "date-fns";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { toast } from "sonner";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/utils";
import { computePricing } from "@/lib/pricing";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  daily_rate_cents: number;
  distance_included_mi: number;
  extra_mile_fee_cents: number;
  location_name: string;
  vehicle_images?: Array<{ url: string; is_cover: boolean }>;
}

function CheckoutForm({
  vehicle,
  from,
  until,
  rateType,
  protectionPlan,
  payLater,
  onBack,
}: {
  vehicle: Vehicle;
  from: string;
  until: string;
  rateType: "refundable" | "non_refundable";
  protectionPlan: "basic" | "standard" | "premium" | null;
  payLater: boolean;
  onBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);

  const days = Math.max(1, differenceInDays(new Date(until), new Date(from)));
  const pricing = computePricing({
    dailyRateCents: vehicle.daily_rate_cents,
    days,
    protectionPlan,
    rateType,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/trips?booking=success`,
      },
    });

    if (error) {
      toast.error(error.message);
      setProcessing(false);
    }
  }

  const coverImage =
    vehicle.vehicle_images?.find((img) => img.is_cover)?.url ??
    vehicle.vehicle_images?.[0]?.url;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <PaymentElement />
      </div>

      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-cascade-700 hover:bg-cascade-900 text-white py-6 text-base font-semibold"
      >
        {processing ? "Processing..." : `Pay ${formatCurrency(pricing.totalCents)}`}
      </Button>

      <Button type="button" variant="ghost" onClick={onBack} className="w-full">
        Back
      </Button>
    </form>
  );
}

function CheckoutPageInner() {
  const params = useParams<{ vehicleId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const from = searchParams.get("from") ?? "";
  const until = searchParams.get("until") ?? "";

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [rateType, setRateType] = useState<"refundable" | "non_refundable">("non_refundable");
  const [protectionPlan, setProtectionPlan] = useState<"basic" | "standard" | "premium" | null>(null);
  const [payLater, setPayLater] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"options" | "payment">("options");

  const days = from && until ? Math.max(1, differenceInDays(new Date(until), new Date(from))) : 1;

  useEffect(() => {
    // Fetch vehicle data
    fetch(`/api/vehicles/${params.vehicleId}`)
      .then((r) => r.json())
      .then((data) => {
        setVehicle(data.vehicle);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Failed to load vehicle");
        setLoading(false);
      });
  }, [params.vehicleId]);

  async function proceedToPayment() {
    if (!from || !until) return;
    setLoading(true);

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId: params.vehicleId,
        from,
        until,
        rateType,
        protectionPlan,
        payLater,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Failed to create booking");
      setLoading(false);
      return;
    }

    setClientSecret(data.clientSecret);
    setStep("payment");
    setLoading(false);
  }

  if (loading && !vehicle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-cascade-700 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!vehicle) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Vehicle not found.</p>
      </div>
    );
  }

  const pricing = computePricing({
    dailyRateCents: vehicle.daily_rate_cents,
    days,
    protectionPlan,
    rateType,
  });

  const coverImage =
    vehicle.vehicle_images?.find((img) => img.is_cover)?.url ??
    vehicle.vehicle_images?.[0]?.url;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-cascade-900 mb-8 text-center">
        Checkout
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left: Options or Payment */}
        <div className="space-y-6">
          {step === "options" ? (
            <>
              {/* Protection Plans */}
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-cascade-900">
                  Protection plans
                </h2>
                <div className="border border-border rounded-xl p-4 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Choose from: Basic, Standard, or Premium coverage.
                  </p>
                  {[
                    { id: null, label: "No protection", price: 0 },
                    { id: "basic" as const, label: "Basic", price: 1199 },
                    { id: "standard" as const, label: "Standard", price: 2199 },
                    { id: "premium" as const, label: "Premium", price: 3499 },
                  ].map(({ id, label, price }) => (
                    <label
                      key={String(id)}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="protection"
                        checked={protectionPlan === id}
                        onChange={() => setProtectionPlan(id)}
                        className="accent-cascade-700"
                      />
                      <span className="flex-1 text-sm font-medium">{label}</span>
                      {price > 0 && (
                        <span className="text-sm text-muted-foreground">
                          +{formatCurrency(price)}/day
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </section>

              {/* Booking rate */}
              <section className="space-y-3">
                <h2 className="text-base font-semibold text-cascade-900">
                  Booking rate
                </h2>
                <div className="space-y-3">
                  {[
                    {
                      id: "non_refundable" as const,
                      label: "Non-refundable",
                      desc: "Cancel for free for 24 hours. After that, the trip is non-refundable.",
                      price: computePricing({ dailyRateCents: vehicle.daily_rate_cents, days, rateType: "non_refundable" }).totalCents,
                    },
                    {
                      id: "refundable" as const,
                      label: "Refundable",
                      desc: "Cancel for free before trip starts. Flexible payment options available.",
                      price: computePricing({ dailyRateCents: vehicle.daily_rate_cents, days, rateType: "refundable" }).totalCents,
                    },
                  ].map(({ id, label, desc, price }) => (
                    <label
                      key={id}
                      className={`block border rounded-xl p-4 cursor-pointer transition-colors ${
                        rateType === id
                          ? "border-cascade-700 bg-cascade-100"
                          : "border-border hover:border-cascade-300"
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-1">
                        <input
                          type="radio"
                          name="rateType"
                          checked={rateType === id}
                          onChange={() => setRateType(id)}
                          className="accent-cascade-700"
                        />
                        <span className="font-semibold text-cascade-900">{label}</span>
                        <span className="ml-auto font-semibold text-cascade-900">
                          {formatCurrency(price)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-7">{desc}</p>
                    </label>
                  ))}
                </div>
              </section>

              {/* Pay timing */}
              {rateType === "refundable" && (
                <section className="space-y-3">
                  <h2 className="text-base font-semibold text-cascade-900">
                    Choose when to pay
                  </h2>
                  <div className="space-y-3">
                    {[
                      { value: false, label: "Pay now", desc: "Charged immediately." },
                      { value: true, label: "Pay over time", desc: "No charge now. Billed at trip start." },
                    ].map(({ value, label, desc }) => (
                      <label
                        key={String(value)}
                        className={`block border rounded-xl p-4 cursor-pointer transition-colors ${
                          payLater === value
                            ? "border-cascade-700 bg-cascade-100"
                            : "border-border hover:border-cascade-300"
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-1">
                          <input
                            type="radio"
                            name="payTiming"
                            checked={payLater === value}
                            onChange={() => setPayLater(value)}
                            className="accent-cascade-700"
                          />
                          <span className="font-semibold text-cascade-900">{label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground pl-7">{desc}</p>
                      </label>
                    ))}
                  </div>
                </section>
              )}

              <Button
                onClick={proceedToPayment}
                disabled={loading}
                className="w-full bg-cascade-700 hover:bg-cascade-900 text-white py-6 text-base font-semibold"
              >
                {loading ? "Processing..." : "Continue to payment"}
              </Button>
            </>
          ) : (
            clientSecret && (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm
                  vehicle={vehicle}
                  from={from}
                  until={until}
                  rateType={rateType}
                  protectionPlan={protectionPlan}
                  payLater={payLater}
                  onBack={() => setStep("options")}
                />
              </Elements>
            )
          )}
        </div>

        {/* Right: Order summary */}
        <div className="lg:sticky lg:top-20 self-start">
          <div className="border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-16 rounded-lg overflow-hidden bg-muted shrink-0">
                {coverImage ? (
                  <Image src={coverImage} alt="Vehicle" fill className="object-cover" sizes="80px" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">🚗</div>
                )}
              </div>
              <div>
                <p className="font-semibold text-cascade-900">
                  {vehicle.make} {vehicle.model}
                </p>
                <p className="text-sm text-muted-foreground">{vehicle.year}</p>
              </div>
            </div>

            <Separator />

            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Dates</span>
                <span>
                  {from && formatDate(from, { month: "short", day: "numeric" })} –{" "}
                  {until && formatDate(until, { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Location</span>
                <span className="text-right max-w-[60%] line-clamp-2">
                  {vehicle.location_name}
                </span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Subtotal ({days} day{days > 1 ? "s" : ""})
                </span>
                <span>{formatCurrency(pricing.subtotalCents)}</span>
              </div>
              {pricing.protectionCostCents > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Protection</span>
                  <span>{formatCurrency(pricing.protectionCostCents)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sales tax</span>
                <span>{formatCurrency(pricing.taxCents)}</span>
              </div>
              <div className="flex justify-between font-bold text-cascade-900 border-t border-border pt-2">
                <span>Trip total</span>
                <span>{formatCurrency(pricing.totalCents)}</span>
              </div>
            </div>

            {pricing.savingsCents > 0 && (
              <div className="bg-alpine-500/10 rounded-lg px-3 py-2 text-xs text-alpine-500 font-medium">
                You&apos;re saving {formatCurrency(pricing.savingsCents)} with the non-refundable rate.
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              {vehicle.distance_included_mi} mi included ·{" "}
              {formatCurrency(vehicle.extra_mile_fee_cents)}/mi after
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading checkout...</div>}>
      <CheckoutPageInner />
    </Suspense>
  );
}
