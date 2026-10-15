"use client";

import { Tile, TileTitle } from "@/components/kit";
import { BoxInput, FieldBox, NoticeSelect, RuleRow, Stepper, Toggle, formatDays } from "../controls";
import type { Errors, WizardData } from "../data";
import { LIMITS } from "@/lib/listing-limits";
import { AddressAutocomplete } from "../AddressAutocomplete";
import type { GeocodeSuggestion } from "@/app/api/geocode/route";

interface Props {
  data: WizardData;
  errors: Errors;
  onChange: (updates: Partial<WizardData>) => void;
}

export function StepRules({ data, errors, onChange }: Props) {
  function handleAddressSelect(s: GeocodeSuggestion) {
    onChange({
      locationAddress: s.label,
      locationName: data.locationName || s.shortName,
      locationLat: s.lat,
      locationLng: s.lng,
    });
  }

  return (
    <>
      <Tile className="flex flex-col gap-2.5">
        <TileTitle className="mb-1">Pickup spot</TileTitle>
        <AddressAutocomplete
          value={data.locationAddress}
          error={!data.locationAddress && errors.locationName ? errors.locationName : undefined}
          onChange={(raw) => onChange({ locationAddress: raw, locationLat: null, locationLng: null })}
          onSelect={handleAddressSelect}
          onClear={() => onChange({ locationAddress: "", locationName: "", locationLat: null, locationLng: null })}
        />
        <FieldBox label="Name shown to guests (auto-filled, edit if needed)" error={errors.locationName}>
          <BoxInput
            value={data.locationName}
            maxLength={80}
            placeholder="e.g. SeaTac Airport, Capitol Hill…"
            onChange={(e) => onChange({ locationName: e.target.value })}
          />
        </FieldBox>
        <p className="px-1 text-sm text-slate">The full address is private. Guests only see the name above.</p>
      </Tile>

      <Tile tone="sky" className="flex flex-col gap-2.5 text-ink">
        <TileTitle className="mb-1">Trips</TileTitle>
        <RuleRow label="Shortest trip">
          <Stepper
            label="shortest trip"
            value={data.minTripDays}
            min={1}
            max={Math.min(LIMITS.minTripMax, data.maxTripDays)}
            format={formatDays}
            onChange={(minTripDays) => onChange({ minTripDays })}
          />
        </RuleRow>
        <RuleRow label="Longest trip">
          <Stepper
            label="longest trip"
            value={data.maxTripDays}
            min={data.minTripDays}
            max={LIMITS.maxTripMax}
            format={formatDays}
            onChange={(maxTripDays) => onChange({ maxTripDays })}
          />
        </RuleRow>
        {errors.maxTripDays && <p className="px-1 text-[13px] font-semibold text-error">{errors.maxTripDays}</p>}
        <RuleRow label="Notice before pickup">
          <NoticeSelect
            value={data.advanceNoticeHours}
            onChange={(advanceNoticeHours) => onChange({ advanceNoticeHours })}
          />
        </RuleRow>
        <Toggle
          label="Instant book"
          hint={data.instantBook ? "On: guests book and pay straight away" : "Off: you approve each request"}
          checked={data.instantBook}
          onChange={(instantBook) => onChange({ instantBook })}
        />
      </Tile>
    </>
  );
}
