"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { IdCard } from "lucide-react";
import { UPLOAD_MAX_BYTES } from "@/lib/licence";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toDateKey } from "@/lib/utils";

type Status = "unverified" | "pending" | "verified" | "failed";

interface Props {
  status: Status;
  /** Why it was rejected, as the host chose it. */
  error: string | null;
  /** The name on the booking, which the licence has to match. */
  name: string;
  /** Needed once: hosts compare it with the licence. */
  hasBirthday: boolean;
  leadClassName?: string;
}

const LEAD: Record<Status, string> = {
  unverified: "Upload a photo of your licence and a selfie holding it. Your host compares them with your booking.",
  pending: "Sent. Your host checks it against your booking, and we'll email you when they have.",
  failed: "Your host couldn't approve it.",
  verified: "Checked. You won't need to send it again.",
};

function PhotoField({
  label,
  help,
  capture,
  onPick,
}: {
  label: string;
  help: string;
  capture?: "user";
  onPick: (file: File | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[14px] font-semibold">{label}</span>
      <span className="text-[13px] text-slate">{help}</span>
      <Input type="file" accept="image/*" capture={capture} required className="py-3" onChange={(e) => onPick(e.target.files?.[0] ?? null)} />
    </label>
  );
}

/** The licence check: where it stands, and the form for sending the two photos. */
export function LicenceCheck({ status, error, name, hasBirthday, leadClassName = "text-sky-ink" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [licence, setLicence] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [birthday, setBirthday] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  function reset(next: boolean) {
    setOpen(next);
    setLicence(null);
    setSelfie(null);
    setProblem(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!licence || !selfie) return;
    setSaving(true);
    setProblem(null);
    const [small, smallSelfie] = await Promise.all([shrinkPhoto(licence), shrinkPhoto(selfie)]);
    if (small.size + smallSelfie.size > UPLOAD_MAX_BYTES) {
      setSaving(false);
      setProblem("Those photos are too big to send. Take them again at a lower quality.");
      return;
    }
    const body = new FormData();
    body.set("licence", small);
    body.set("selfie", smallSelfie);
    if (!hasBirthday) body.set("date_of_birth", birthday);
    const res = await fetch("/api/licence", { method: "POST", body }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setProblem(data?.error ?? "Upload failed. Try again.");
      return;
    }
    setOpen(false);
    toast.success("Sent. We'll email you when your host has checked it.");
    router.refresh();
  }

  return (
    <span className="flex flex-col items-start gap-3">
      <span className={`text-[15px] ${leadClassName}`}>
        {LEAD[status]}
        {status === "failed" && error && <> {error}</>}
      </span>
      {status !== "verified" && (
        <Dialog open={open} onOpenChange={reset}>
          <DialogTrigger asChild>
            <Button variant={status === "pending" ? "secondary" : "default"}>
              <IdCard />
              {status === "unverified" ? "Upload my licence" : "Send new photos"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[92vh] overflow-y-auto">
            <DialogTitle>Your driver&apos;s licence</DialogTitle>
            <DialogDescription className="text-[15px] text-slate">
              Your host checks these against your booking. Your name has to match the licence: {name}. Only your host and
              Cascade can see the photos.
            </DialogDescription>
            <form onSubmit={submit} className="flex flex-col gap-4">
              <PhotoField label="Photo of your licence" help="The front, flat and in good light, with every word readable." onPick={setLicence} />
              <PhotoField label="Selfie holding your licence" help="Your face and the licence both in the picture." capture="user" onPick={setSelfie} />
              {!hasBirthday && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[14px] font-semibold">Date of birth, as on your licence</span>
                  <Input type="date" required max={toDateKey(new Date())} value={birthday} onChange={(e) => setBirthday(e.target.value)} />
                </label>
              )}
              {problem && <p className="rounded-[14px] bg-error-soft px-3 py-2 text-sm font-semibold text-error">{problem}</p>}
              <Button type="submit" disabled={saving || !licence || !selfie}>
                {saving ? "Sending…" : "Send to my host"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </span>
  );
}
