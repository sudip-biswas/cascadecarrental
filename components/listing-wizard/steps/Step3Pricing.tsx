import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/utils";
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

export function Step3Pricing({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-cascade-900">Pricing</h2>

      <Field label="Daily rate" hint="This is the base price guests see per day.">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">$</span>
          <Input
            type="number"
            min={10}
            max={500}
            value={data.dailyRateCents / 100}
            onChange={(e) =>
              onChange({ dailyRateCents: Math.round(parseFloat(e.target.value) * 100) || 5000 })
            }
          />
          <span className="text-muted-foreground text-sm">per day</span>
        </div>
        <div className="mt-2">
          <Slider
            min={1000}
            max={50000}
            step={500}
            value={[data.dailyRateCents]}
            onValueChange={([v]) => onChange({ dailyRateCents: v })}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>$10</span>
            <span className="font-semibold text-cascade-900">
              {formatCurrency(data.dailyRateCents)}/day
            </span>
            <span>$500</span>
          </div>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Weekly discount (%)" hint="Applied for trips 7+ days.">
          <Input
            type="number"
            min={0}
            max={30}
            value={data.weeklyDiscountPct}
            onChange={(e) =>
              onChange({ weeklyDiscountPct: parseInt(e.target.value) || 0 })
            }
          />
        </Field>

        <Field label="Monthly discount (%)" hint="Applied for trips 30+ days.">
          <Input
            type="number"
            min={0}
            max={50}
            value={data.monthlyDiscountPct}
            onChange={(e) =>
              onChange({ monthlyDiscountPct: parseInt(e.target.value) || 0 })
            }
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Miles included per day"
          hint="Guests won't be charged for miles within this limit."
        >
          <Input
            type="number"
            min={50}
            max={500}
            value={data.distanceIncludedMi}
            onChange={(e) =>
              onChange({ distanceIncludedMi: parseInt(e.target.value) || 200 })
            }
          />
        </Field>

        <Field
          label="Extra mile fee"
          hint="Charged per mile over the included amount."
        >
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">$</span>
            <Input
              type="number"
              min={0.1}
              max={2}
              step={0.05}
              value={data.extraMileFeeCents / 100}
              onChange={(e) =>
                onChange({
                  extraMileFeeCents: Math.round(parseFloat(e.target.value) * 100) || 20,
                })
              }
            />
            <span className="text-muted-foreground text-sm">/mile</span>
          </div>
        </Field>
      </div>

      <div className="bg-cascade-100 rounded-xl p-4 text-sm space-y-1">
        <p className="font-semibold text-cascade-900">Estimated earnings</p>
        <p className="text-muted-foreground">
          For a 3-day trip:{" "}
          <span className="font-semibold text-cascade-900">
            {formatCurrency(data.dailyRateCents * 3 * 0.8)}
          </span>{" "}
          (after ~20% platform fee)
        </p>
      </div>
    </div>
  );
}
