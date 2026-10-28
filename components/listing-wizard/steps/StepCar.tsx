"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Tile } from "@/components/kit";
import { cn } from "@/lib/utils";
import { BoxInput, BoxSelect, BoxTextarea, FieldBox } from "../controls";
import {
  FUEL_LABELS,
  FUEL_TYPES,
  TRANSMISSIONS,
  TYPE_LABELS,
  VEHICLE_TYPES,
  type Errors,
  type WizardData,
} from "../data";
import { LIMITS } from "@/lib/listing-limits";
import { suggestDailyRate } from "@/lib/suggested-rate";

interface Props {
  data: WizardData;
  errors: Errors;
  onChange: (updates: Partial<WizardData>) => void;
  /** VIN or plate already on Cascade. Blocks Next until it's fixed. */
  onConflict: (field: "vin" | "licensePlate", message: string | null) => void;
}

interface Decoded {
  make?: string;
  model?: string;
  year?: number;
  trim?: string | null;
  fuelType?: WizardData["fuelType"] | null;
  transmission?: WizardData["transmission"] | null;
  seats?: number | null;
  vehicleType?: WizardData["vehicleType"] | null;
  error?: string;
}

const YEARS = Array.from({ length: LIMITS.yearMax - LIMITS.yearMin + 1 }, (_, i) => LIMITS.yearMax - i);

export function StepCar({ data, errors, onChange, onConflict }: Props) {
  const [lookup, setLookup] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const [lookupError, setLookupError] = useState("");
  // A draft typed in by hand reopens with the fields showing.
  const [editing, setEditing] = useState(Boolean(data.make && !data.vin));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const request = useRef<AbortController>(undefined);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      request.current?.abort();
    },
    []
  );

  async function decode(vin: string) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLookup("loading");
    try {
      const res = await fetch(`/api/vehicles/decode-vin?vin=${encodeURIComponent(vin)}`, {
        signal: controller.signal,
      });
      const json = (await res.json()) as Decoded;
      if (res.status === 409) {
        onConflict("vin", json.error ?? "A car with this VIN is already on Cascade.");
        setLookup("failed");
        setLookupError(json.error ?? "");
        return;
      }
      if (!res.ok || !json.make) {
        setLookup("failed");
        setLookupError(json.error ?? "We couldn't look that up. Fill in the details yourself.");
        setEditing(true);
        return;
      }
      const resolvedType = json.vehicleType ?? data.vehicleType;
      const resolvedYear = json.year ?? data.year;
      onChange({
        make: json.make,
        model: json.model ?? data.model,
        year: resolvedYear,
        trim: json.trim ?? "",
        ...(json.fuelType ? { fuelType: json.fuelType } : {}),
        ...(json.transmission ? { transmission: json.transmission } : {}),
        ...(json.seats && json.seats <= LIMITS.seatsMax ? { seats: json.seats } : {}),
        ...(json.vehicleType ? { vehicleType: json.vehicleType } : {}),
        dailyRateCents: suggestDailyRate(resolvedType, resolvedYear, json.make, json.model ?? data.model),
      });
      setLookup("done");
      setEditing(false);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setLookup("failed");
      setLookupError("We couldn't look that up. Fill in the details yourself.");
      setEditing(true);
    }
  }

  function changeVin(raw: string) {
    const vin = raw.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17);
    onChange({ vin });
    onConflict("vin", null);
    setLookup("idle");
    setLookupError("");
    clearTimeout(timer.current);
    if (vin.length === 17) timer.current = setTimeout(() => decode(vin), 300);
  }

  async function checkPlate(plate: string) {
    if (!plate.trim()) return;
    const res = await fetch(`/api/vehicles/check-plate?plate=${encodeURIComponent(plate)}`);
    if (res.status === 409) {
      const json = (await res.json()) as { error?: string };
      onConflict("licensePlate", json.error ?? "You already have a car with this plate.");
    }
  }

  const summary = [
    TYPE_LABELS[data.vehicleType],
    FUEL_LABELS[data.fuelType].toLowerCase(),
    data.transmission,
    `${data.seats} seats`,
  ].join(" · ");
  const showFields = editing || Boolean(errors.make || errors.model || errors.year || errors.seats);
  const showSummary = !showFields && data.make && data.model;

  return (
    <>
      <Tile className="flex flex-col gap-3">
        <label
          className={cn(
            "flex items-center gap-3 rounded-[18px] px-4 py-3 ring-2",
            errors.vin ? "bg-error-soft ring-error" : "bg-white ring-ink"
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-slate">VIN</span>
            <input
              value={data.vin}
              onChange={(e) => changeVin(e.target.value)}
              placeholder="17 letters and numbers"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="w-full min-w-0 bg-transparent p-0 text-[19px] font-bold tracking-[0.05em] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-quiet sm:text-[22px]"
            />
          </span>
          <span className="figures shrink-0 text-sm font-bold">{data.vin.length} / 17</span>
        </label>
        {errors.vin && <p className="px-1 text-[13px] font-semibold text-error">{errors.vin}</p>}

        {lookup === "loading" && (
          <div className="flex items-center gap-3 rounded-[20px] bg-board p-4 text-[15px] font-semibold">
            <Loader2 className="size-5 animate-spin" />
            Looking up the VIN…
          </div>
        )}

        {lookup === "failed" && lookupError && !errors.vin && (
          <div className="rounded-[20px] bg-error-soft p-4 text-[15px] font-semibold text-error">{lookupError}</div>
        )}

        {showSummary && lookup !== "loading" && (
          <div className="flex flex-wrap items-center gap-3.5 rounded-[20px] bg-mint p-4 text-mint-ink">
            <span className="flex size-[46px] shrink-0 items-center justify-center rounded-[14px] bg-ink">
              <Check className="size-[22px] text-white" strokeWidth={2.5} />
            </span>
            <span className="flex min-w-0 flex-[1_1_220px] flex-col gap-1">
              <span className="font-display text-[24px] leading-tight font-extrabold text-ink">
                {[data.year, data.make, data.model, data.trim].filter(Boolean).join(" ")}
              </span>
              <span className="text-[15px]">{summary}</span>
            </span>
            <button type="button" onClick={() => setEditing(true)} className="text-[15px] font-bold text-ink hover:text-cobalt">
              Not right? Edit
            </button>
          </div>
        )}

        {!showSummary && !showFields && lookup !== "loading" && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="self-start px-1 text-[15px] font-bold underline-offset-4 hover:text-cobalt hover:underline"
          >
            No VIN to hand? Fill in the details yourself
          </button>
        )}

        {showFields && (
          <div className="grid grid-cols-2 gap-2.5">
            <FieldBox label="Make" error={errors.make}>
              <BoxInput value={data.make} placeholder="Toyota" onChange={(e) => onChange({ make: e.target.value })} />
            </FieldBox>
            <FieldBox label="Model" error={errors.model}>
              <BoxInput value={data.model} placeholder="RAV4" onChange={(e) => onChange({ model: e.target.value })} />
            </FieldBox>
            <FieldBox label="Year" error={errors.year}>
              <BoxSelect value={data.year} onChange={(e) => onChange({ year: Number(e.target.value) })}>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </BoxSelect>
            </FieldBox>
            <FieldBox label="Trim (optional)">
              <BoxInput value={data.trim} placeholder="LE" onChange={(e) => onChange({ trim: e.target.value })} />
            </FieldBox>
            <FieldBox label="Type">
              <BoxSelect
                value={data.vehicleType}
                onChange={(e) => onChange({ vehicleType: e.target.value as WizardData["vehicleType"] })}
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </BoxSelect>
            </FieldBox>
            <FieldBox label="Fuel">
              <BoxSelect
                value={data.fuelType}
                onChange={(e) => onChange({ fuelType: e.target.value as WizardData["fuelType"] })}
              >
                {FUEL_TYPES.map((f) => (
                  <option key={f} value={f}>
                    {FUEL_LABELS[f]}
                  </option>
                ))}
              </BoxSelect>
            </FieldBox>
            <FieldBox label="Gearbox">
              <BoxSelect
                value={data.transmission}
                onChange={(e) => onChange({ transmission: e.target.value as WizardData["transmission"] })}
              >
                {TRANSMISSIONS.map((t) => (
                  <option key={t} value={t}>
                    {t === "automatic" ? "Automatic" : "Manual"}
                  </option>
                ))}
              </BoxSelect>
            </FieldBox>
            <FieldBox label="Seats" error={errors.seats}>
              <BoxInput
                type="number"
                inputMode="numeric"
                min={LIMITS.seatsMin}
                max={LIMITS.seatsMax}
                value={data.seats || ""}
                onChange={(e) => onChange({ seats: Number(e.target.value) })}
              />
            </FieldBox>
          </div>
        )}
      </Tile>

      <Tile className="grid grid-cols-2 gap-2.5">
        <FieldBox label="Plate" error={errors.licensePlate}>
          <BoxInput
            value={data.licensePlate}
            placeholder="ABC1234"
            maxLength={LIMITS.plateMax}
            autoCapitalize="characters"
            onChange={(e) => {
              onChange({ licensePlate: e.target.value.toUpperCase() });
              onConflict("licensePlate", null);
            }}
            onBlur={(e) => checkPlate(e.target.value)}
          />
        </FieldBox>
        <FieldBox label="Colour (optional)">
          <BoxInput value={data.color} placeholder="Grey" onChange={(e) => onChange({ color: e.target.value })} />
        </FieldBox>
        <FieldBox label="MPG (optional)" error={errors.mpg} className="col-span-2 sm:col-span-1">
          <BoxInput
            type="number"
            inputMode="numeric"
            min={LIMITS.mpgMin}
            max={LIMITS.mpgMax}
            placeholder="32"
            value={data.mpg}
            onChange={(e) => onChange({ mpg: e.target.value })}
          />
        </FieldBox>
        <FieldBox label="A line about the car (optional)" className="col-span-2">
          <BoxTextarea
            rows={2}
            maxLength={1000}
            value={data.description}
            placeholder="Roof rails, all-weather mats, two snowboards fit with the seats down."
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </FieldBox>
      </Tile>
    </>
  );
}
