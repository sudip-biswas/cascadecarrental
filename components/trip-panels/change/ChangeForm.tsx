"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PriceRow } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TripDatesPicker } from "@/components/search/TripDatesPicker";
import { bookedNights, type DateKey, type Range } from "@/components/search/dates";
import type { ChangePricing } from "@/lib/trip-changes";
import { formatCurrency, formatDateTime, pluralize } from "@/lib/utils";
import { ReturnPicker } from "./ReturnPicker";

interface Quote {
  startsAt: string;
  endsAt: string;
  pricing: ChangePricing;
  differenceCents: number;
  summary: string;
}

type QuoteState = { key: string; quote: Quote | null; error: string | null };

interface Props {
  tripId: string;
  /** Once the trip has started only the return can move. */
  started: boolean;
  from: DateKey;
  until: DateKey;
  fromTime: string;
  untilTime: string;
  /** Other bookings and blocks on the car. */
  ranges: Range[];
  host: string;
}

/** "Change trip": new times, a live price for them, and the request to the host. */
export function ChangeForm({ tripId, started, ranges, host, ...current }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<DateKey | undefined>(current.from);
  const [until, setUntil] = useState<DateKey | undefined>(current.until);
  const [fromTime, setFromTime] = useState(current.fromTime);
  const [untilTime, setUntilTime] = useState(current.untilTime);
  const [result, setResult] = useState<QuoteState | null>(null);
  const [sending, setSending] = useState(false);
  const booked = useMemo(() => bookedNights(ranges), [ranges]);

  const unchanged =
    from === current.from && until === current.until && fromTime === current.fromTime && untilTime === current.untilTime;
  const key = from && until && !unchanged ? new URLSearchParams({ from, until, fromTime, untilTime }).toString() : null;

  useEffect(() => {
    if (!key || !open) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}/changes?${key}`, { signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        setResult(res.ok ? { key, quote: data, error: null } : { key, quote: null, error: data.error ?? "Couldn't price those dates." });
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResult({ key, quote: null, error: "Couldn't price those dates." });
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, open, tripId]);

  const loading = !!key && result?.key !== key;
  const quote = !loading && key ? result?.quote : null;
  const error = !loading && key ? result?.error : null;

  async function send() {
    if (!from || !until) return;
    setSending(true);
    const res = await fetch(`/api/trips/${tripId}/changes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, until, fromTime, untilTime }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't send the change. Try again.");
      return;
    }
    setOpen(false);
    toast.success(`Sent to ${host}. Nothing changes until they accept.`);
    router.refresh();
  }

  const diff = quote?.differenceCents ?? 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">Change trip</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Change trip</DialogTitle>
        <DialogDescription className="text-[15px] text-slate">
          {started
            ? `Pick a new return. ${host} has to accept before anything changes.`
            : `Pick new times. ${host} has to accept before anything changes.`}
        </DialogDescription>

        {started ? (
          <ReturnPicker
            start={current.from}
            until={until}
            untilTime={untilTime}
            booked={booked}
            onChange={(day, time) => {
              setUntil(day);
              setUntilTime(time);
            }}
          />
        ) : (
          <TripDatesPicker
            from={from}
            until={until}
            fromTime={fromTime}
            untilTime={untilTime}
            booked={booked}
            onChange={(f, u) => {
              setFrom(f);
              setUntil(u);
            }}
            onTimeChange={(f, u) => {
              setFromTime(f);
              setUntilTime(u);
            }}
          />
        )}

        <div className="flex min-h-[112px] flex-col justify-center gap-1.5 rounded-[16px] bg-board px-3.5 py-3" aria-live="polite">
          {!key ? (
            <span className="text-[15px] text-slate">
              {unchanged ? "Pick the new times to see the price." : "Now pick the return day."}
            </span>
          ) : loading ? (
            <span className="text-[15px] text-slate">Checking the price…</span>
          ) : error ? (
            <span className="text-[15px] font-semibold text-error">{error}</span>
          ) : quote ? (
            <>
              <span className="text-[15px] font-semibold">
                {formatDateTime(quote.startsAt)} to {formatDateTime(quote.endsAt)}, {pluralize(quote.pricing.days, "day")}
              </span>
              <PriceRow label="New total" value={formatCurrency(quote.pricing.totalCents)} />
              <PriceRow
                strong
                label={diff > 0 ? "You pay" : diff < 0 ? "You get back" : "Difference"}
                value={formatCurrency(Math.abs(diff))}
              />
              <span className="text-[14px] text-slate">{quote.summary}</span>
            </>
          ) : null}
        </div>

        <Button disabled={!quote || sending} onClick={send}>
          {sending ? "Sending…" : `Send to ${host}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
