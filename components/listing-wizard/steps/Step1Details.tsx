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

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-ember-500 ml-1">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function Step1Details({ data, onChange }: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-cascade-900">Vehicle details</h2>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Make" required>
          <Input
            placeholder="Toyota"
            value={data.make}
            onChange={(e) => onChange({ make: e.target.value })}
          />
        </Field>

        <Field label="Model" required>
          <Input
            placeholder="RAV4"
            value={data.model}
            onChange={(e) => onChange({ model: e.target.value })}
          />
        </Field>

        <Field label="Year" required>
          <Select
            value={String(data.year)}
            onValueChange={(v) => onChange({ year: parseInt(v) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Trim">
          <Input
            placeholder="LE, SE, TRD..."
            value={data.trim}
            onChange={(e) => onChange({ trim: e.target.value })}
          />
        </Field>

        <Field label="Color">
          <Input
            placeholder="White"
            value={data.color}
            onChange={(e) => onChange({ color: e.target.value })}
          />
        </Field>

        <Field label="License plate" required>
          <Input
            placeholder="ABC1234"
            value={data.licensePlate}
            onChange={(e) => onChange({ licensePlate: e.target.value.toUpperCase() })}
          />
        </Field>

        <Field label="VIN (optional)">
          <Input
            placeholder="17-character VIN"
            value={data.vin}
            onChange={(e) => onChange({ vin: e.target.value.toUpperCase() })}
            maxLength={17}
          />
        </Field>

        <Field label="Vehicle type" required>
          <Select
            value={data.vehicleType}
            onValueChange={(v) => onChange({ vehicleType: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Fuel type" required>
          <Select
            value={data.fuelType}
            onValueChange={(v) => onChange({ fuelType: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FUEL_TYPES.map((f) => (
                <SelectItem key={f} value={f}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Transmission" required>
          <Select
            value={data.transmission}
            onValueChange={(v) => onChange({ transmission: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSMISSIONS.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Seats" required>
          <Input
            type="number"
            min={2}
            max={12}
            value={data.seats}
            onChange={(e) => onChange({ seats: parseInt(e.target.value) || 5 })}
          />
        </Field>

        <Field label="Fuel efficiency (MPG)">
          <Input
            type="number"
            placeholder="32"
            value={data.mpg}
            onChange={(e) => onChange({ mpg: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Pickup location" required>
        <Input
          placeholder="Seattle-Tacoma International Airport"
          value={data.locationName}
          onChange={(e) => onChange({ locationName: e.target.value })}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Full address or landmark where guests will pick up the car.
        </p>
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
