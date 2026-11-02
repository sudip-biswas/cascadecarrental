"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, IdCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Status = "unverified" | "pending" | "verified" | "failed";

function PhotoSlot({
  label,
  icon,
  file,
  onChange,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  file: File | null;
  onChange: (f: File | null) => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const preview = file ? URL.createObjectURL(file) : null;

  return (
    <label
      className={cn(
        "flex flex-1 cursor-pointer flex-col items-center gap-3 rounded-[18px] border-2 border-dashed p-5 text-center transition-colors",
        file ? "border-transparent bg-board" : "border-line hover:border-ink/30"
      )}
    >
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt={label} className="h-28 w-full rounded-[12px] object-cover" />
      ) : (
        <span className="flex size-14 items-center justify-center rounded-[18px] bg-board text-slate">
          {icon}
        </span>
      )}
      <span className="text-[15px] font-semibold">{file ? "Change photo" : label}</span>
    </label>
  );
}

/**
 * Guest upload form: licence photo + selfie. Shown inside ChecksPanel when
 * the check-in isn't yet approved.
 */
export function CheckinUpload({
  tripId,
  status,
  rejectionNotes,
}: {
  tripId: string;
  status: Status;
  rejectionNotes: string | null;
}) {
  const router = useRouter();
  const [license, setLicense] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "pending") {
    return (
      <p className="text-[15px] text-slate">
        Under review. We&apos;ll let you know when the host approves.
      </p>
    );
  }

  async function submit() {
    if (!license || !selfie) return;
    setSubmitting(true);
    const form = new FormData();
    form.append("license", license);
    form.append("selfie", selfie);

    const res = await fetch(`/api/trips/${tripId}/checkin`, { method: "POST", body: form }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { error?: string } | null;

    if (!res?.ok) {
      toast.error(body?.error ?? "Couldn't submit. Try again.");
      setSubmitting(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {status === "failed" && rejectionNotes && (
        <p className="rounded-[14px] bg-peach px-3 py-2 text-sm font-semibold text-peach-ink">{rejectionNotes}</p>
      )}
      <p className="text-[15px] text-slate">
        A photo of the front of your licence, and a selfie so the host can match your face to it.
      </p>
      <div className="flex gap-2">
        <PhotoSlot
          label="Front of licence"
          icon={<IdCard className="size-6" strokeWidth={1.75} />}
          file={license}
          onChange={setLicense}
          disabled={submitting}
        />
        <PhotoSlot
          label="Selfie"
          icon={<Camera className="size-6" strokeWidth={1.75} />}
          file={selfie}
          onChange={setSelfie}
          disabled={submitting}
        />
      </div>
      <Button
        onClick={submit}
        disabled={!license || !selfie || submitting}
        className="self-start"
      >
        {submitting ? "Submitting…" : "Submit for review"}
      </Button>
    </div>
  );
}
