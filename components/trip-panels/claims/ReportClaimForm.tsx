"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PhotoPicker, photosForUpload } from "./PhotoPicker";

export function ReportClaimForm({
  tripId,
  viewer,
  defaultDate,
  defaultTime,
  minDate,
  maxDate,
  startOpen,
}: {
  tripId: string;
  viewer: "guest" | "host";
  defaultDate: string;
  defaultTime: string;
  minDate: string;
  maxDate: string;
  startOpen: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(startOpen);
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState(defaultTime);
  const [description, setDescription] = useState("");
  const [estimate, setEstimate] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const cents = Math.round(Number(estimate) * 100);
  const valid = !!date && !!time && description.trim().length >= 10 && (!estimate || cents >= 100);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    const body = new FormData();
    body.set("incidentDate", date);
    body.set("incidentTime", time);
    body.set("description", description.trim());
    if (estimate) body.set("estimateCents", String(cents));
    if (!(await photosForUpload(photos, body))) {
      setSaving(false);
      toast.error("Those photos are too big together. Send fewer, you can add more after.");
      return;
    }
    const res = await fetch(`/api/trips/${tripId}/claims`, { method: "POST", body }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const { error } = (await res?.json().catch(() => null)) ?? { error: null };
      toast.error(error ?? "Couldn't save the report. Try again.");
      return;
    }
    toast.success("Damage reported.");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Report damage
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 rounded-[20px] bg-board p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-semibold">Date of the incident</span>
          <Input type="date" min={minDate} max={maxDate} value={date} onChange={(e) => setDate(e.target.value)} className="bg-white" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-semibold">Time, Seattle</span>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="bg-white" />
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[14px] font-semibold">What happened</span>
        <Textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
          placeholder="Where the damage is and how it happened."
          className="bg-white"
        />
      </label>
      {viewer === "host" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-semibold">Repair estimate, if you have one</span>
          <Input
            inputMode="decimal"
            placeholder="0.00"
            value={estimate}
            onChange={(e) => setEstimate(e.target.value.replace(/[^\d.]/g, ""))}
            className="bg-white"
          />
        </label>
      )}
      <PhotoPicker photos={photos} onChange={setPhotos} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!valid || saving}>
          {saving ? "Sending…" : "Send report"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
