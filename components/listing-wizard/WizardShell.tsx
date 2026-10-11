"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Step1Details } from "./steps/Step1Details";
import { Step2Photos } from "./steps/Step2Photos";
import { Step3Pricing } from "./steps/Step3Pricing";
import { Step4Availability } from "./steps/Step4Availability";
import { Step5Review } from "./steps/Step5Review";

export interface WizardData {
  // Step 1
  make: string;
  model: string;
  year: number;
  trim: string;
  color: string;
  licensePlate: string;
  vin: string;
  vehicleType: string;
  fuelType: string;
  transmission: string;
  seats: number;
  mpg: string;
  description: string;
  locationName: string;
  locationLat: number;
  locationLng: number;
  // Step 2
  images: Array<{ file: File; url: string; isCover: boolean }>;
  // Step 3
  dailyRateCents: number;
  weeklyDiscountPct: number;
  monthlyDiscountPct: number;
  distanceIncludedMi: number;
  extraMileFeeCents: number;
  // Step 4
  minTripDays: number;
  maxTripDays: number;
  advanceNoticeHours: number;
  instantBook: boolean;
}

const STEPS = [
  { label: "Details", component: Step1Details },
  { label: "Photos", component: Step2Photos },
  { label: "Pricing", component: Step3Pricing },
  { label: "Availability", component: Step4Availability },
  { label: "Review", component: Step5Review },
];

const defaultData: WizardData = {
  make: "",
  model: "",
  year: new Date().getFullYear(),
  trim: "",
  color: "",
  licensePlate: "",
  vin: "",
  vehicleType: "sedan",
  fuelType: "gasoline",
  transmission: "automatic",
  seats: 5,
  mpg: "",
  description: "",
  locationName: "",
  locationLat: 47.6062,
  locationLng: -122.3321,
  images: [],
  dailyRateCents: 5000,
  weeklyDiscountPct: 5,
  monthlyDiscountPct: 10,
  distanceIncludedMi: 200,
  extraMileFeeCents: 20,
  minTripDays: 1,
  maxTripDays: 30,
  advanceNoticeHours: 1,
  instantBook: true,
};

export function ListingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(defaultData);
  const [submitting, setSubmitting] = useState(false);

  const CurrentStep = STEPS[step].component;
  const progress = ((step + 1) / STEPS.length) * 100;

  function updateData(updates: Partial<WizardData>) {
    setData((prev) => ({ ...prev, ...updates }));
  }

  function goNext() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    setSubmitting(true);

    // Upload images first
    const uploadedImages: Array<{ url: string; isCover: boolean; position: number }> = [];
    for (let i = 0; i < data.images.length; i++) {
      const img = data.images[i];
      const formData = new FormData();
      formData.append("file", img.file);
      formData.append("isCover", String(img.isCover || i === 0));
      formData.append("position", String(i));

      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!res.ok) {
        toast.error("Failed to upload image");
        setSubmitting(false);
        return;
      }
      const { url } = await res.json();
      uploadedImages.push({ url, isCover: img.isCover || i === 0, position: i });
    }

    // Create vehicle
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, images: uploadedImages }),
    });

    if (!res.ok) {
      toast.error("Failed to create listing");
      setSubmitting(false);
      return;
    }

    const { vehicleId } = await res.json();
    toast.success("Your car has been listed!");
    router.push(`/host/vehicles/${vehicleId}`);
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-cascade-900">
            Step {step + 1} of {STEPS.length}: {STEPS[step].label}
          </span>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step tabs */}
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <button
            key={s.label}
            onClick={() => i < step && setStep(i)}
            className={`flex-1 py-1.5 text-xs font-medium rounded transition-colors ${
              i === step
                ? "bg-cascade-700 text-white"
                : i < step
                ? "bg-cascade-100 text-cascade-700 cursor-pointer"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
            disabled={i > step}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white border border-border rounded-2xl p-6">
        <CurrentStep data={data} onChange={updateData} />
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={goBack}
          disabled={step === 0}
        >
          Back
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            onClick={goNext}
            className="bg-cascade-700 hover:bg-cascade-900 text-white"
          >
            Continue
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-cascade-700 hover:bg-cascade-900 text-white"
          >
            {submitting ? "Publishing..." : "Publish listing"}
          </Button>
        )}
      </div>
    </div>
  );
}
