"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ChargeKind } from "@/lib/supabase/types";
import { cn, formatCurrency, pluralize } from "@/lib/utils";
import { CHARGE_KINDS } from "./kinds";

const PHOTOS_MAX = 6;
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 1600;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

export interface MilesSuggestion {
  driven: number;
  includedMi: number | null;
  overMi: number;
  overCents: number;
  feeCents: number;
}

/** Scales a photo down so a handful fit in one request. Anything the browser can't draw goes as it is. */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function milesNote(m: MilesSuggestion) {
  return `${pluralize(m.overMi, "mile")} over the ${m.includedMi?.toLocaleString("en-US")} included (${m.driven.toLocaleString("en-US")} driven), at ${formatCurrency(m.feeCents)} a mile.`;
}

export function RequestChargeForm({
  tripId,
  tollsOnly,
  miles,
}: {
  tripId: string;
  /** During the trip only tolls can be sent. */
  tollsOnly: boolean;
  miles: MilesSuggestion | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ChargeKind | null>(tollsOnly ? "tolls" : null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);

  const kinds = tollsOnly ? CHARGE_KINDS.filter((k) => k.kind === "tolls") : CHARGE_KINDS;
  const milesReady = !!miles && miles.overCents >= 100;
  const isMiles = kind === "extra_miles";
  const cents = isMiles ? (miles?.overCents ?? 0) : Math.round(Number(amount) * 100);
  const valid = !!kind && cents >= 100 && cents <= 2_000_000 && description.trim().length >= 3 && (!isMiles || milesReady);

  function pick(next: ChargeKind) {
    setKind(next);
    if (next === "extra_miles" && miles && milesReady) setDescription(milesNote(miles));
  }

  function add(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (files.some((f) => f.size > PHOTO_MAX_BYTES)) toast.error("Each photo has to be under 10 MB.");
    const ok = files.filter((f) => f.size <= PHOTO_MAX_BYTES);
    if (photos.length + ok.length > PHOTOS_MAX) toast.error(`Up to ${PHOTOS_MAX} photos.`);
    setPhotos((p) => [...p, ...ok].slice(0, PHOTOS_MAX));
  }

  function reset() {
    setOpen(false);
    setKind(tollsOnly ? "tolls" : null);
    setAmount("");
    setDescription("");
    setPhotos([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !kind) return;
    setSaving(true);
    const body = new FormData();
    body.set("kind", kind);
    if (!isMiles) body.set("amountCents", String(cents));
    body.set("description", description.trim());
    for (const file of await Promise.all(photos.map(shrink))) body.append("photos", file);
    const res = await fetch(`/api/trips/${tripId}/charges`, { method: "POST", body }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const { error } = (await res?.json().catch(() => null)) ?? { error: null };
      toast.error(error ?? "Couldn't send the charge. Try again.");
      return;
    }
    toast.success("Charge sent. The guest has 3 days to pay or dispute it.");
    reset();
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        {tollsOnly ? "Send a toll charge" : "Request a charge"}
      </Button>
    );
  }

  const hint = CHARGE_KINDS.find((k) => k.kind === kind)?.hint;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-[20px] bg-board p-4">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="What it's for">
        {kinds.map((k) => (
          <button
            key={k.kind}
            type="button"
            role="radio"
            aria-checked={kind === k.kind}
            onClick={() => pick(k.kind)}
            className={cn(
              "rounded-[10px] px-3 py-2 text-[14px] font-bold transition-colors",
              kind === k.kind ? "bg-ink text-white" : "bg-white text-ink hover:bg-line"
            )}
          >
            {k.label}
          </button>
        ))}
      </div>
      {hint && <p className="text-[14px] text-slate">{hint}</p>}

      {isMiles ? (
        <div className="figures flex items-baseline justify-between rounded-[14px] bg-white px-3.5 py-3">
          <span className="text-[15px] font-semibold">
            {!miles
              ? "Needs both odometer readings"
              : miles.includedMi == null
                ? "This trip had unlimited miles"
                : `${pluralize(miles.overMi, "mile")} over`}
          </span>
          <span className="text-[22px] font-extrabold">{milesReady ? formatCurrency(miles!.overCents) : "None"}</span>
        </div>
      ) : (
        kind && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold">Amount</span>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="bg-white"
            />
          </label>
        )
      )}

      {kind && (
        <>
          <Textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={2000}
            placeholder="What it's for, so the guest knows."
            className="bg-white"
          />
          <div className="flex flex-wrap items-center gap-2">
            {photos.map((file, i) => (
              <span key={`${file.name}-${i}`} className="flex items-center gap-1 rounded-[10px] bg-white py-1.5 pr-1.5 pl-3 text-[13px] font-semibold">
                <span className="max-w-[140px] truncate">{file.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${file.name}`}
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                  className="flex size-6 items-center justify-center rounded-full hover:bg-board"
                >
                  <X className="size-3.5" strokeWidth={2.25} />
                </button>
              </span>
            ))}
            {photos.length < PHOTOS_MAX && (
              <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
                <ImagePlus />
                Add photos
              </Button>
            )}
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              multiple
              hidden
              onChange={(e) => {
                add(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!valid || saving}>
          {saving ? "Sending…" : cents >= 100 ? `Send ${formatCurrency(cents)} charge` : "Send charge"}
        </Button>
        <Button type="button" variant="ghost" onClick={reset}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
