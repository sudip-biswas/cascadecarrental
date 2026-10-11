"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, differenceInDays } from "date-fns";
import { Calendar, MapPin, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";
import { computePricing } from "@/lib/pricing";
import type { DateRange } from "react-day-picker";
import type { Vehicle } from "@/types";

interface Props {
  vehicle: Vehicle;
  initialFrom?: string;
  initialUntil?: string;
  isLoggedIn: boolean;
}

export function BookingSidebar({ vehicle, initialFrom, initialUntil, isLoggedIn }: Props) {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    initialFrom && initialUntil
      ? { from: new Date(initialFrom), to: new Date(initialUntil) }
      : undefined
  );

  const days =
    dateRange?.from && dateRange?.to
      ? Math.max(1, differenceInDays(dateRange.to, dateRange.from))
      : 0;

  const pricing =
    days > 0
      ? computePricing({ dailyRateCents: vehicle.daily_rate_cents, days })
      : null;

  function handleContinue() {
    if (!dateRange?.from || !dateRange?.to) return;

    if (!isLoggedIn) {
      router.push(
        `/login?redirectTo=/cars/${vehicle.id}/checkout&from=${format(dateRange.from, "yyyy-MM-dd")}&until=${format(dateRange.to, "yyyy-MM-dd")}`
      );
      return;
    }

    const params = new URLSearchParams({
      from: format(dateRange.from, "yyyy-MM-dd"),
      until: format(dateRange.to, "yyyy-MM-dd"),
    });
    router.push(`/cars/${vehicle.id}/checkout?${params.toString()}`);
  }

  return (
    <div className="bg-white border border-border rounded-2xl p-6 shadow-lg space-y-4 sticky top-20">
      {/* Price header */}
      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-cascade-900">
            {formatCurrency(vehicle.daily_rate_cents)}
          </span>
          <span className="text-muted-foreground text-sm">/day</span>
        </div>
        {pricing && (
          <p className="text-sm text-muted-foreground">
            {formatCurrency(pricing.totalCents)} total before taxes
          </p>
        )}
      </div>

      <Separator />

      {/* Trip dates */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your trip
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button className="border border-border rounded-lg p-3 text-left hover:border-cascade-500 transition-colors">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">
                  Trip start
                </p>
                <p className="text-sm font-medium text-cascade-900">
                  {dateRange?.from ? format(dateRange.from, "MMM d, yyyy") : "Add date"}
                </p>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                disabled={{ before: new Date() }}
                numberOfMonths={1}
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <button className="border border-border rounded-lg p-3 text-left hover:border-cascade-500 transition-colors">
                <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-0.5">
                  Trip end
                </p>
                <p className="text-sm font-medium text-cascade-900">
                  {dateRange?.to ? format(dateRange.to, "MMM d, yyyy") : "Add date"}
                </p>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <CalendarComponent
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                disabled={[{ before: new Date() }, ...(dateRange?.from ? [{ before: dateRange.from }] : [])]}
                defaultMonth={dateRange?.from}
                numberOfMonths={1}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Pickup location */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted rounded-lg px-3 py-2">
        <MapPin className="w-4 h-4 text-cascade-500 shrink-0" />
        <span className="line-clamp-1">{vehicle.location_name}</span>
      </div>

      {/* Price breakdown */}
      {pricing && days > 0 && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {formatCurrency(vehicle.daily_rate_cents)} × {days} day{days > 1 ? "s" : ""}
            </span>
            <span>{formatCurrency(pricing.subtotalCents)}</span>
          </div>
          <div className="flex justify-between font-semibold text-cascade-900 pt-1 border-t border-border">
            <span>Trip total</span>
            <span>{formatCurrency(pricing.totalCents)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Before taxes and fees</p>
        </div>
      )}

      <Button
        onClick={handleContinue}
        disabled={!dateRange?.from || !dateRange?.to}
        className="w-full bg-cascade-700 hover:bg-cascade-900 text-white rounded-xl py-6 text-base font-semibold"
      >
        Continue
      </Button>

      {/* Policies */}
      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-2 text-muted-foreground">
          <Shield className="w-4 h-4 mt-0.5 text-cascade-500 shrink-0" />
          <div>
            <p className="font-medium text-cascade-900">Free cancellation</p>
            <p className="text-xs">Full refund within 24 hours of booking.</p>
          </div>
        </div>

        <div className="flex items-start gap-2 text-muted-foreground">
          <Calendar className="w-4 h-4 mt-0.5 text-cascade-500 shrink-0" />
          <div>
            <p className="font-medium text-cascade-900">
              {vehicle.distance_included_mi} mi included
            </p>
            <p className="text-xs">
              {formatCurrency(vehicle.extra_mile_fee_cents)}/mi fee for additional miles.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
