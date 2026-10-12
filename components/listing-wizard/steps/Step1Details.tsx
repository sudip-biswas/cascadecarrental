"use client";

import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WizardData } from "../WizardShell";

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

const VEHICLE_TYPES = ["sedan", "suv", "truck", "van", "sports", "luxury", "electric"];
const FUEL_TYPES = ["gasoline", "hybrid", "electric", "diesel"];
const TRANSMISSIONS = ["automatic", "manual"];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 25 }, (_, i) => CURRENT_YEAR - i);

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-ember-500 ml-1">*</span>}</Label>
      {children}
    </div>
  );
}

type DecodeState = "idle" | "loading" | "success" | "error";

export function Step1Details({ data, onChange }: Props) {
  const [decodeState, setDecodeState] = useState<DecodeState>("idle");
  const [decodeError, setDecodeError] = useState("");
  const [plateError, setPlateError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function decodeVin(vin: string) {
    setDecodeState("loading");
    setDecodeError("");
    try {
      const res = await fetch(`/api/vehicles/decode-vin?vin=${encodeURIComponent(vin)}`);
      const json = await res.json();
      if (!res.ok) {
        setDecodeState("error");
        setDecodeError(json.error ?? "Could not decode VIN");
        return;
      }
      const updates: Partial<WizardData> = {};
      if (json.make) updates.make = json.make;
      if (json.model) updates.model = json.model;
      if (json.year) updates.year = json.year;
      if (json.trim) updates.trim = json.trim;
      if (json.fuelType) updates.fuelType = json.fuelType;
      if (json.transmission) updates.transmission = json.transmission;
      if (json.seats) updates.seats = json.seats;
      if (json.vehicleType) updates.vehicleType = json.vehicleType;
      onChange(updates);
      setDecodeState("success");
    } catch {
      setDecodeState("error");
      setDecodeError("Network error — fill in details manually");
    }
  }

  function handleVinChange(raw: string) {
    const vin = raw.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
    onChange({ vin });
    setDecodeState("idle");
    setDecodeError("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (vin.length === 17) {
      debounceRef.current = setTimeout(() => decodeVin(vin), 400);
    }
  }

  async function checkPlate(plate: string) {
    if (!plate) return;
    setPlateError("");
    const res = await fetch(`/api/vehicles/check-plate?plate=${encodeURIComponent(plate)}`);
    if (res.status === 409) {
      const { error } = await res.json();
      setPlateError(error);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-cascade-900">Vehicle details</h2>

      {/* VIN first — auto-fills everything */}
      <div className="space-y-1.5">
        <Label>
          VIN
          <span className="text-muted-foreground font-normal ml-1 text-xs">(auto-fills make, model, year &amp; more)</span>
        </Label>
        <div className="relative">
          <Input
            placeholder="17-character VIN"
            value={data.vin}
            onChange={(e) => handleVinChange(e.target.value)}
            maxLength={17}
            className={cn(
              "pr-10 font-mono uppercase tracking-widest",
              decodeState === "error" && "border-ember-500 focus-visible:ring-ember-500",
              decodeState === "success" && "border-alpine-500 focus-visible:ring-alpine-500"
            )}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {decodeState === "loading" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            {decodeState === "success" && <CheckCircle2 className="w-4 h-4 text-alpine-500" />}
            {decodeState === "error" && <AlertCircle className="w-4 h-4 text-ember-500" />}
          </div>
        </div>
        {decodeState === "success" && (
          <p className="text-xs text-alpine-500">Details filled from VIN — review and adjust below if needed.</p>
        )}
        {decodeState === "error" && decodeError && (
          <p className="text-xs text-ember-500">{decodeError}</p>
        )}
        {data.vin.length > 0 && data.vin.length < 17 && (
          <p className="text-xs text-muted-foreground">{17 - data.vin.length} characters remaining</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Make" required>
          <Input placeholder="Toyota" value={data.make} onChange={(e) => onChange({ make: e.target.value })} />
        </Field>

        <Field label="Model" required>
          <Input placeholder="RAV4" value={data.model} onChange={(e) => onChange({ model: e.target.value })} />
        </Field>

        <Field label="Year" required>
          <Select value={String(data.year)} onValueChange={(v) => onChange({ year: parseInt(v) })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Trim">
          <Input placeholder="LE, SE, TRD..." value={data.trim} onChange={(e) => onChange({ trim: e.target.value })} />
        </Field>

        <Field label="Color">
          <Input placeholder="White" value={data.color} onChange={(e) => onChange({ color: e.target.value })} />
        </Field>

        <Field label="License plate" required>
          <Input
            placeholder="ABC1234"
            value={data.licensePlate}
            onChange={(e) => { onChange({ licensePlate: e.target.value.toUpperCase() }); setPlateError(""); }}
            onBlur={(e) => checkPlate(e.target.value)}
            className={plateError ? "border-ember-500 focus-visible:ring-ember-500" : ""}
          />
          {plateError && <p className="text-xs text-ember-500 mt-1">{plateError}</p>}
        </Field>

        <Field label="Vehicle type" required>
          <Select value={data.vehicleType} onValueChange={(v) => onChange({ vehicleType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {VEHICLE_TYPES.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Fuel type" required>
          <Select value={data.fuelType} onValueChange={(v) => onChange({ fuelType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FUEL_TYPES.map((f) => <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Transmission" required>
          <Select value={data.transmission} onValueChange={(v) => onChange({ transmission: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRANSMISSIONS.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Seats" required>
          <Input type="number" min={2} max={12} value={data.seats} onChange={(e) => onChange({ seats: parseInt(e.target.value) || 5 })} />
        </Field>

        <Field label="Fuel efficiency (MPG)">
          <Input type="number" placeholder="32" value={data.mpg} onChange={(e) => onChange({ mpg: e.target.value })} />
        </Field>
      </div>

      <Field label="Pickup location" required>
        <Input
          placeholder="Seattle-Tacoma International Airport"
          value={data.locationName}
          onChange={(e) => onChange({ locationName: e.target.value })}
        />
        <p className="text-xs text-muted-foreground mt-1">Full address or landmark where guests will pick up the car.</p>
      </Field>

      <Field label="Description">
        <Textarea
          placeholder="Tell guests what makes your car great..."
          rows={4}
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </Field>
    </div>
  );
}
