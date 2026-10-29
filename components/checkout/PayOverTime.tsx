"use client";

import { useEffect } from "react";
import { Elements, PaymentElement, PaymentMethodMessagingElement, useElements } from "@stripe/react-stripe-js";
import type { Appearance, StripeElements } from "@stripe/stripe-js";
import { getStripe } from "@/lib/stripe/client";
import { payOverTimeFor } from "@/lib/pay-over-time";

/** Where a note to the host waits while the guest is on a lender's page. */
export const pendingNoteKey = (tripId: string) => `cascade:note:${tripId}`;

/** Sends the checkout note once the guest is back from the lender and the trip went through. */
export function PendingNote({ tripId }: { tripId: string }) {
  useEffect(() => {
    let body: string | null = null;
    try {
      body = sessionStorage.getItem(pendingNoteKey(tripId));
      sessionStorage.removeItem(pendingNoteKey(tripId));
    } catch {
      return;
    }
    if (!body) return;
    fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, tripId }),
    }).catch(() => null);
  }, [tripId]);
  return null;
}

/**
 * "Pay in 4 interest-free payments of $X" from the lenders that take this
 * total. Renders nothing when none do. Brings its own Elements unless it's
 * already inside one, like on checkout.
 */
export function PayOverTimeNote({ amountCents, standalone = true }: { amountCents: number; standalone?: boolean }) {
  const types = payOverTimeFor(amountCents);
  if (types.length === 0) return null;
  const note = (
    <PaymentMethodMessagingElement
      options={{ amount: amountCents, currency: "USD", paymentMethodTypes: types, countryCode: "US" }}
    />
  );
  return standalone ? <Elements stripe={getStripe()}>{note}</Elements> : note;
}

/** Hands the card form's Elements up to the checkout, which submits both forms together. */
function Expose({ onElements }: { onElements: (elements: StripeElements | null) => void }) {
  const elements = useElements();
  useEffect(() => {
    onElements(elements);
    return () => onElements(null);
  }, [elements, onElements]);
  return <PaymentElement options={{ layout: "tabs", wallets: { applePay: "never", googlePay: "never" } }} />;
}

/**
 * The card a pay-over-time trip keeps on file. Klarna, Affirm and Afterpay
 * can't be charged again, so the deposit hold and costs after the trip go here.
 */
export function CardOnFile({
  appearance,
  fonts,
  onElements,
}: {
  appearance: Appearance;
  fonts: { cssSrc: string }[];
  onElements: (elements: StripeElements | null) => void;
}) {
  return (
    <Elements
      stripe={getStripe()}
      options={{
        mode: "setup",
        currency: "usd",
        setupFutureUsage: "off_session",
        allowedPaymentMethodTypes: ["card"],
        appearance,
        fonts,
      }}
    >
      <Expose onElements={onElements} />
    </Elements>
  );
}
