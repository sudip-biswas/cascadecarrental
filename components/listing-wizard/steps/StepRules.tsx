"use client";

import { Tile, TileTitle } from "@/components/kit";
import { BoxInput, FieldBox, NoticeSelect, RuleRow, Stepper, Toggle, formatDays } from "../controls";
import type { Errors, WizardData } from "../data";
import { LIMITS } from "@/lib/listing-limits";

interface Props {
  data: WizardData;
  errors: Errors;
  onChange: (updates: Partial<WizardData>) => void;
}

export function StepRules({ data, errors, onChange }: Props) {
  return (
    <>
      <Tile className="flex flex-col gap-2.5">
        <TileTitle className="mb-1">Pickup spot</TileTitle>
        <FieldBox label="Area guests see, like a neighbourhood or the airport" error={errors.locationName}>
          <BoxInput
            value={data.locationName}
            maxLength={80}
            placeholder="SeaTac"
            onChange={(e) => onChange({ locationName: e.target.value })}
          />
        </FieldBox>
        <FieldBox label="Exact address (optional)">
          <BoxInput
            value={data.locationAddress}
            maxLength={200}
            autoComplete="street-address"
            placeholder="Street, city, ZIP"
            onChange={(e) => onChange({ locationAddress: e.target.value })}
          />
        </FieldBox>
        <p className="px-1 text-sm text-slate">The address isn&apos;t shown on your listing. Guests only see the area.</p>
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
