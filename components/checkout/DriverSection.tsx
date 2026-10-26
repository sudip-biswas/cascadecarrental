"use client";

import { useState } from "react";
import Link from "next/link";
import { IdCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { YOUNG_DRIVER_AGE } from "@/lib/pricing";
import { formatPrice, toDateKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice, Section } from "./parts";
import type { DriverCheck, DriverRules } from "./rules";

/** Age and license rules for this car. Only shows when there's something to do or know. */
export function DriverSection({
  car,
  check,
  licenseRequired,
  userId,
  onDateOfBirth,
}: {
  car: DriverRules;
  check: DriverCheck;
  licenseRequired: boolean;
  userId: string;
  onDateOfBirth: (dateOfBirth: string) => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!licenseRequired && check.ok && check.youngDriverDailyCents === 0) return null;

  async function save() {
    setError(null);
    const year = Number(value.slice(0, 4));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || year < 1900 || value >= toDateKey(new Date())) {
      setError("Enter your date of birth.");
      return;
    }
    setSaving(true);
    const { error: saveError } = await createClient()
      .from("profiles")
      .update({ date_of_birth: value })
      .eq("id", userId);
    setSaving(false);
    if (saveError) {
      setError("Couldn't save that. Try again.");
      return;
    }
    onDateOfBirth(value);
  }

  return (
    <Section icon={<IdCard />} iconTone="bg-peach" title="Driver">
      {licenseRequired && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-board p-4">
          <span className="text-[15px]">Verify your driver&apos;s license before you book.</span>
          <Button asChild size="sm">
            <Link href="/profile">Verify on your profile</Link>
          </Button>
        </div>
      )}

      {!check.ok && check.reason === "needs_dob" && (
        <div className="flex flex-col gap-2">
          <p className="text-[15px] text-slate">
            Drivers have to be {car.min_age} or older for this car
            {car.young_driver_fee_cents > 0
              ? `, and under ${YOUNG_DRIVER_AGE} adds ${formatPrice(car.young_driver_fee_cents)}/day`
              : ""}
            . When were you born?
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              type="date"
              value={value}
              max={toDateKey(new Date())}
              onChange={(e) => setValue(e.target.value)}
              aria-label="Date of birth"
              aria-invalid={!!error}
              className="w-auto flex-[1_1_200px]"
            />
            <Button type="button" onClick={save} disabled={saving || !value}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
          {error && <Notice>{error}</Notice>}
        </div>
      )}

      {!check.ok && check.reason === "too_young" && <Notice>{check.message}</Notice>}

      {check.ok && check.youngDriverDailyCents > 0 && (
        <Notice tone="peach">
          You&apos;re under {YOUNG_DRIVER_AGE}, so this car adds a young driver fee of{" "}
          {formatPrice(check.youngDriverDailyCents)}/day.
        </Notice>
      )}
    </Section>
  );
}
