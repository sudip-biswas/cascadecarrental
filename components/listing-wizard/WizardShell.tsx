"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { LogoMark } from "@/components/layout/Logo";
import { cn } from "@/lib/utils";
import {
  DEFAULT_DATA,
  STEPS,
  clearDraft,
  loadDraft,
  saveDraft,
  validateStep,
  type Errors,
  type StepIndex,
  type WizardData,
} from "./data";
import { LIMITS } from "@/lib/listing-limits";
import { Preview } from "./Preview";
import { StepCar } from "./steps/StepCar";
import { StepPhotos } from "./steps/StepPhotos";
import { PriceExample, StepPrice } from "./steps/StepPrice";
import { StepReview } from "./steps/StepReview";
import { StepRules } from "./steps/StepRules";

const HEADINGS: Record<StepIndex, { title: string; lead: string }> = {
  0: {
    title: "Start with the VIN.",
    lead: "It's on the dashboard by the windshield, and on your insurance card. We fill in the rest.",
  },
  1: { title: "Show it off.", lead: "Three photos to go live. Daylight, outside, whole car in frame." },
  2: { title: "Set your price.", lead: "One daily rate. Change it any time, trips already booked keep their price." },
  3: { title: "Your rules.", lead: "Where guests pick up and for how long. You can change it later in Pickup and hours." },
  4: { title: "Ready to go.", lead: "One last look. Tap anything to change it." },
};

const NEXT_LABEL: Record<StepIndex, string> = {
  0: "Next: photos",
  1: "Next: price",
  2: "Next: rules",
  3: "Review",
  4: "Publish",
};

// Pickup spots aren't geocoded yet, so new cars sit on the Seattle default.
const SEATTLE = { lat: 47.6062, lng: -122.3321 };

export function ListingWizard() {
  const router = useRouter();
  // Rendered client-only (see WizardLoader), so reading the draft here is safe.
  const [initial] = useState(() => loadDraft());
  const [data, setData] = useState<WizardData>(() =>
    initial ? { ...initial.data, photos: [] } : DEFAULT_DATA
  );
  // Photos can't be kept between visits, so a restored draft resumes at the photos step at most.
  const [step, setStep] = useState<StepIndex>(() =>
    initial ? (Math.min(initial.step, 1) as StepIndex) : 0
  );
  const [reached, setReached] = useState<StepIndex>(() =>
    initial ? (Math.min(initial.reached, 1) as StepIndex) : 0
  );
  const [errors, setErrors] = useState<Errors>({});
  const [conflicts, setConflicts] = useState<Errors>({});
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => saveDraft(data, step, reached), [data, step, reached]);

  function update(updates: Partial<WizardData>) {
    setData((d) => ({ ...d, ...updates }));
    // Clear the message on a field as soon as it's touched.
    setErrors((e) => {
      const next = { ...e };
      for (const key of Object.keys(updates) as (keyof WizardData)[]) delete next[key];
      return next;
    });
  }

  function setConflict(field: "vin" | "licensePlate", message: string | null) {
    setConflicts((c) => {
      const next = { ...c };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  }

  function problems(s: StepIndex): Errors {
    return s === 0 ? { ...validateStep(0, data), ...conflicts } : validateStep(s, data);
  }

  function goTo(s: StepIndex) {
    setErrors({});
    setStep(s);
    window.scrollTo({ top: 0 });
  }

  function next() {
    const found = problems(step);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      toast.error(Object.values(found)[0]);
      return;
    }
    if (step === 4) return publish();
    const to = (step + 1) as StepIndex;
    setReached((r) => (to > r ? to : r));
    goTo(to);
  }

  async function publish() {
    for (const s of [0, 1, 2, 3] as StepIndex[]) {
      const found = problems(s);
      if (Object.keys(found).length > 0) {
        goTo(s);
        setErrors(found);
        toast.error(Object.values(found)[0]);
        return;
      }
    }

    const images: { url: string }[] = [];
    for (const [i, photo] of data.photos.entries()) {
      setProgress(`Uploading photo ${i + 1} of ${data.photos.length}`);
      const form = new FormData();
      form.append("file", photo.file);
      const res = await fetch("/api/uploads", { method: "POST", body: form }).catch(() => null);
      const json = (await res?.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res?.ok || !json?.url) {
        setProgress(null);
        toast.error(json?.error ?? "A photo didn't upload. Check your connection and try again.");
        return;
      }
      images.push({ url: json.url });
    }

    setProgress("Publishing");
    const { photos, ...fields } = data;
    void photos;
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...fields,
        mpg: fields.mpg.trim() || undefined,
        locationLat: data.locationLat ?? SEATTLE.lat,
        locationLng: data.locationLng ?? SEATTLE.lng,
        images,
      }),
    }).catch(() => null);
    const json = (await res?.json().catch(() => null)) as { vehicleId?: string; listed?: boolean; error?: string } | null;

    if (!res?.ok || !json?.vehicleId) {
      setProgress(null);
      toast.error(json?.error ?? "Couldn't publish. Try again.");
      return;
    }

    clearDraft();
    data.photos.forEach((p) => URL.revokeObjectURL(p.url));
    toast.success(json.listed ? "Your car is live." : "Saved. It goes live once it has 3 photos.");
    router.push(`/host/vehicles/${json.vehicleId}`);
  }

  const busy = progress !== null;
  const heading = HEADINGS[step];
  const publishLabel = data.photos.length >= LIMITS.photosToList ? "Publish" : "Save without listing";

  return (
    <div className="flex min-h-dvh flex-col bg-board">
      <header className="bg-white">
        <div className="mx-auto flex w-full max-w-[1280px] flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3.5 sm:px-6">
          <span className="flex items-center gap-2.5">
            <LogoMark size={34} />
            <span className="font-display text-[22px] font-extrabold">List your car</span>
          </span>
          <Link
            href="/host/vehicles"
            className="rounded-[12px] bg-board px-3.5 py-[11px] text-[15px] font-bold transition-colors hover:bg-line sm:order-last"
          >
            Save and exit
          </Link>
          <ol aria-label="Steps" className="grid w-full grid-cols-5 gap-1.5 sm:w-auto sm:max-w-[620px] sm:flex-[1_1_460px]">
            {STEPS.map((label, i) => {
              const s = i as StepIndex;
              const done = s <= step;
              const canJump = s <= reached && !busy;
              return (
                <li key={label}>
                  <button
                    type="button"
                    disabled={!canJump}
                    onClick={() => goTo(s)}
                    aria-current={s === step ? "step" : undefined}
                    className="flex w-full flex-col gap-1.5 text-left disabled:cursor-default"
                  >
                    <span className={cn("h-2 rounded-[4px]", done ? "bg-ink" : "bg-line")} />
                    <span className={cn("truncate text-[13px]", s === step ? "font-extrabold" : "font-semibold text-slate")}>
                      <span className="max-sm:hidden">{i + 1} </span>
                      {label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-wrap items-start gap-5 px-4 pt-7 pb-12 sm:px-6 sm:pt-9">
        <main className="flex min-w-0 flex-[999_1_600px] flex-col gap-3.5">
          <h1 className="headline text-[clamp(44px,6vw,88px)]">{heading.title}</h1>
          <p className="mb-1.5 max-w-[600px] text-[17px] text-slate sm:text-[18px]">{heading.lead}</p>

          {step === 0 && <StepCar data={data} errors={errors} onChange={update} onConflict={setConflict} />}
          {step === 1 && <StepPhotos data={data} errors={errors} onChange={update} />}
          {step === 2 && <StepPrice data={data} errors={errors} onChange={update} />}
          {step === 3 && <StepRules data={data} errors={errors} onChange={update} />}
          {step === 4 && <StepReview data={data} onEdit={goTo} />}
        </main>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-2.5 lg:sticky lg:top-5">
          <Preview data={data} step={step} />
          {step === 0 && (
            <div className="rounded-[20px] bg-sky px-4 py-3.5 text-sm text-sky-ink">
              Already on Cascade with this VIN? You&apos;ll hear it here, not after uploading photos.
            </div>
          )}
          {step === 2 && <PriceExample dailyRateCents={data.dailyRateCents} />}
          {step === 4 && (
            <span className="text-center text-sm text-slate">You can pause it any time from My cars.</span>
          )}
        </aside>
      </div>

      <div className="sticky bottom-0 z-10 bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          {step > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => goTo((step - 1) as StepIndex)}
              className="rounded-[14px] bg-board px-[18px] py-3.5 text-base font-bold transition-colors hover:bg-line disabled:opacity-50"
            >
              Back
            </button>
          ) : (
            <span />
          )}
          <span className="text-center text-[15px] font-semibold text-slate" aria-live="polite">
            {progress ?? (
              <>
                Step {step + 1} of 5<span className="max-sm:hidden"> · details saved on this device</span>
              </>
            )}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={next}
            className="flex h-14 items-center gap-2 rounded-[15px] bg-ink px-5 text-[17px] font-bold text-white transition-colors hover:bg-graphite disabled:bg-graphite sm:px-[26px]"
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : null}
            {step === 4 ? publishLabel : NEXT_LABEL[step]}
            {step < 4 && <ArrowRight className="size-[18px]" strokeWidth={2} />}
          </button>
        </div>
      </div>
    </div>
  );
}
