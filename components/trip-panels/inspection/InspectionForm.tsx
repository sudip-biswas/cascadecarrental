"use client";
/* eslint-disable @next/next/no-img-element -- local object URLs and signed links, not optimisable */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, ImagePlus, ImageOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { InspectionKind } from "@/lib/inspections";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { cn, pluralize } from "@/lib/utils";

/** Same as INSPECTION_LIMITS, which can't be imported here because lib/inspections is server code. */
const INSPECTION_LIMITS = { photosMax: 12, photoMaxBytes: 10 * 1024 * 1024, notesMax: 2000 } as const;

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

/** Photos go up in requests of about this size, under hosting body limits. */
const BATCH_BYTES = 4 * 1024 * 1024;

interface Pick {
  id: string;
  /** Set for photos already saved on this inspection. */
  path?: string;
  file?: File;
  url: string | null;
}

export interface ExistingInspection {
  odometer_mi: number | null;
  fuel_pct: number | null;
  notes: string | null;
  photoUrls: { path: string; url: string | null }[];
}

/** Splits new photos into requests that each stay under the batch size. */
function batches(files: File[]) {
  const out: File[][] = [[]];
  let size = 0;
  for (const file of files) {
    const last = out[out.length - 1];
    if (last.length && size + file.size > BATCH_BYTES) {
      out.push([file]);
      size = file.size;
    } else {
      last.push(file);
      size += file.size;
    }
  }
  return out;
}

function Thumb({ pick, onRemove }: { pick: Pick; onRemove: () => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="relative">
      {pick.url && !broken ? (
        <img src={pick.url} alt="" className="aspect-square w-full rounded-[12px] object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-[12px] bg-board text-[12px] font-semibold text-slate">
          <ImageOff className="size-5" strokeWidth={1.75} />
          {pick.file?.name.split(".").pop()?.toUpperCase() ?? "Photo"}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove photo"
        className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-white text-ink transition-colors hover:bg-line"
      >
        <X className="size-4" strokeWidth={2.25} />
      </button>
    </div>
  );
}

export function InspectionForm({
  tripId,
  kind,
  electric,
  existing,
  onDone,
}: {
  tripId: string;
  kind: InspectionKind;
  electric: boolean;
  existing: ExistingInspection | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [picks, setPicks] = useState<Pick[]>(
    () => existing?.photoUrls.map((p) => ({ id: p.path, path: p.path, url: p.url })) ?? []
  );
  const [odometer, setOdometer] = useState(existing?.odometer_mi?.toString() ?? "");
  const [level, setLevel] = useState(existing?.fuel_pct ?? 100);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState<string | null>(null);

  // Free the previews when the form goes away.
  const previews = useRef(new Set<string>());
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const room = INSPECTION_LIMITS.photosMax - picks.length;
  const levelLabel = electric ? "Charge" : "Fuel";

  function add(list: FileList | null) {
    const files = Array.from(list ?? []);
    const big = files.filter((f) => f.size > INSPECTION_LIMITS.photoMaxBytes);
    if (big.length) toast.error(`${pluralize(big.length, "photo")} skipped: each has to be under 10 MB.`);
    const ok = files.filter((f) => f.size <= INSPECTION_LIMITS.photoMaxBytes);
    if (ok.length > room) toast.error(`Up to ${INSPECTION_LIMITS.photosMax} photos.`);
    const added = ok.slice(0, room).map((file) => {
      const url = URL.createObjectURL(file);
      previews.current.add(url);
      return { id: crypto.randomUUID(), file, url };
    });
    if (added.length) setPicks((p) => [...p, ...added]);
  }

  function remove(id: string) {
    const pick = picks.find((p) => p.id === id);
    if (pick?.file && pick.url) {
      URL.revokeObjectURL(pick.url);
      previews.current.delete(pick.url);
    }
    setPicks((p) => p.filter((x) => x.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (picks.length === 0 || odometer === "") return;
    setSaving("Getting photos ready…");
    const files = await Promise.all(picks.filter((p) => p.file).map((p) => shrinkPhoto(p.file!)));
    let keep = picks.filter((p) => p.path).map((p) => p.path!);
    const parts = batches(files);

    for (const [i, part] of parts.entries()) {
      setSaving(parts.length > 1 ? `Uploading ${i + 1} of ${parts.length}…` : "Uploading…");
      const body = new FormData();
      body.set("kind", kind);
      body.set("odometer_mi", odometer);
      body.set("fuel_pct", String(level));
      body.set("notes", notes.trim());
      keep.forEach((path) => body.append("keep", path));
      part.forEach((file) => body.append("photos", file));
      const res = await fetch(`/api/trips/${tripId}/inspections`, { method: "POST", body }).catch(() => null);
      if (!res?.ok) {
        const { error } = (await res?.json().catch(() => null)) ?? { error: null };
        toast.error(error ?? "Couldn't save it. Try again.");
        setSaving(null);
        // Whatever made it up is saved, so show it.
        if (i > 0) router.refresh();
        return;
      }
      // The next request keeps everything saved so far.
      const { inspection } = await res.json();
      keep = inspection.photos;
    }

    setSaving(null);
    toast.success(kind === "pickup" ? "Checked in." : "Checked out.");
    onDone?.();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-[18px] bg-white p-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[15px] font-semibold">Photos</span>
          <span className="text-[13px] text-slate">
            {picks.length} of {INSPECTION_LIMITS.photosMax}
          </span>
        </div>
        <p className="text-[14px] text-slate">
          All four sides, the wheels, the inside, and the dashboard with the odometer and {levelLabel.toLowerCase()} showing.
        </p>
        {picks.length > 0 && (
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {picks.map((pick) => (
              <Thumb key={pick.id} pick={pick} onRemove={() => remove(pick.id)} />
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" disabled={room <= 0} onClick={() => camera.current?.click()} className="sm:hidden">
            <Camera />
            Take photo
          </Button>
          <Button type="button" variant="secondary" size="sm" disabled={room <= 0} onClick={() => library.current?.click()}>
            <ImagePlus />
            Add photos
          </Button>
        </div>
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={library}
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

      <label className="flex flex-col gap-1.5">
        <span className="text-[15px] font-semibold">Odometer</span>
        <span className="relative">
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={2_000_000}
            step={1}
            required
            placeholder="e.g. 24180"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            className="bg-white pr-12"
          />
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[15px] text-slate">mi</span>
        </span>
      </label>

      <div className="flex flex-col gap-2.5 rounded-[14px] bg-white px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span id={`${kind}-level`} className="text-[15px] font-semibold">
            {levelLabel}
          </span>
          <span className="figures text-[15px] font-extrabold">{level}%</span>
        </div>
        <Slider
          aria-labelledby={`${kind}-level`}
          min={0}
          max={100}
          step={5}
          value={[level]}
          onValueChange={([v]) => setLevel(v)}
          className="py-2"
        />
        <div className="flex justify-between text-[12px] font-semibold text-slate">
          <span>Empty</span>
          <span>Full</span>
        </div>
      </div>

      <Textarea
        placeholder="Scratches, dents, warning lights, anything worth noting (optional)"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={INSPECTION_LIMITS.notesMax}
        className="bg-white"
      />

      <Button type="submit" disabled={saving != null || picks.length === 0 || odometer === ""} className={cn(saving && "cursor-wait")}>
        {saving ??
          (picks.length === 0
            ? "Add at least one photo"
            : existing
              ? "Save changes"
              : kind === "pickup"
                ? "Check in"
                : "Check out")}
      </Button>
    </form>
  );
}
