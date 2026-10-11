import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { WizardData } from "../WizardShell";

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Step4Availability({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-cascade-900">Availability</h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Minimum trip length (days)">
          <Input
            type="number"
            min={1}
            max={7}
            value={data.minTripDays}
            onChange={(e) =>
              onChange({ minTripDays: parseInt(e.target.value) || 1 })
            }
          />
        </Field>

        <Field label="Maximum trip length (days)">
          <Input
            type="number"
            min={data.minTripDays}
            max={90}
            value={data.maxTripDays}
            onChange={(e) =>
              onChange({ maxTripDays: parseInt(e.target.value) || 30 })
            }
          />
        </Field>
      </div>

      <Field
        label="Advance notice (hours)"
        hint="Minimum notice required before a trip starts."
      >
        <Input
          type="number"
          min={0}
          max={72}
          value={data.advanceNoticeHours}
          onChange={(e) =>
            onChange({ advanceNoticeHours: parseInt(e.target.value) || 1 })
          }
        />
      </Field>

      <div className="flex items-start gap-3 border border-border rounded-xl p-4">
        <Checkbox
          id="instantBook"
          checked={data.instantBook}
          onCheckedChange={(v) => onChange({ instantBook: !!v })}
          className="mt-0.5"
        />
        <div>
          <label
            htmlFor="instantBook"
            className="font-medium text-cascade-900 cursor-pointer"
          >
            Instant book
          </label>
          <p className="text-sm text-muted-foreground mt-0.5">
            Guests can book without waiting for your approval. Recommended for
            faster bookings and better visibility.
          </p>
        </div>
      </div>
    </div>
  );
}
