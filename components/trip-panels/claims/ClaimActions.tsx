"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";
import { PhotoPicker, photosForUpload } from "./PhotoPicker";

type Action = { action: "ask_guest"; amountCents: number; description: string } | { action: "escalate" } | { action: "close"; note: string };

async function send(tripId: string, claimId: string, body: Action) {
  const res = await fetch(`/api/trips/${tripId}/claims/${claimId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const data = (await res?.json().catch(() => null)) ?? {};
  return { ok: !!res?.ok, error: data.error as string | undefined };
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="rounded-[14px] bg-error-soft px-3.5 py-3 text-[15px] font-semibold text-error">
      {error}
    </p>
  );
}

function AskGuestToPay({
  tripId,
  claimId,
  estimateCents,
  description,
}: {
  tripId: string;
  claimId: string;
  estimateCents: number | null;
  description: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(estimateCents ? (estimateCents / 100).toFixed(2) : "");
  const [note, setNote] = useState(description);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cents = Math.round(Number(amount) * 100);
  const valid = cents >= 100 && cents <= 2_000_000 && note.trim().length >= 3;

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await send(tripId, claimId, { action: "ask_guest", amountCents: cents, description: note.trim() });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't send it. Try again.");
      return;
    }
    setOpen(false);
    toast.success("Charge sent. The guest has 3 days to pay or dispute it.");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Ask the guest to pay</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Ask the guest to pay</DialogTitle>
        <DialogDescription className="text-[15px] text-slate">
          It goes to them as a damage charge with your photos. They have 3 days to pay or dispute it.
        </DialogDescription>
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-semibold">Amount</span>
          <Input inputMode="decimal" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-semibold">What it&apos;s for</span>
          <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
        </label>
        <ErrorLine error={error} />
        <div className="grid grid-cols-2 gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Back</Button>
          </DialogClose>
          <Button disabled={!valid || busy} onClick={submit}>
            {busy ? "Sending…" : cents >= 100 ? `Send ${formatCurrency(cents)}` : "Send"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Escalate({ tripId, claimId }: { tripId: string; claimId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await send(tripId, claimId, { action: "escalate" });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't send it. Try again.");
      return;
    }
    setOpen(false);
    toast.success("Sent to Cascade.");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Escalate to Cascade
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Escalate to Cascade?</DialogTitle>
        <DialogDescription className="text-[15px] text-slate">
          Cascade looks at both sides and records an outcome. Documents are due in 15 days. Cascade doesn&apos;t pay for repairs.
        </DialogDescription>
        <ErrorLine error={error} />
        <div className="grid grid-cols-2 gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Back</Button>
          </DialogClose>
          <Button disabled={busy} onClick={submit}>
            {busy ? "Sending…" : "Escalate"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CloseClaim({ tripId, claimId }: { tripId: string; claimId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await send(tripId, claimId, { action: "close", note: note.trim() });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't close it. Try again.");
      return;
    }
    setOpen(false);
    toast.success("Claim closed.");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          Close the claim
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Close this claim?</DialogTitle>
        <DialogDescription className="text-[15px] text-slate">The guest is told. You can&apos;t reopen it.</DialogDescription>
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          placeholder="How it was sorted, if you like."
          aria-label="Note to the guest"
        />
        <ErrorLine error={error} />
        <div className="grid grid-cols-2 gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Back</Button>
          </DialogClose>
          <Button disabled={busy} onClick={submit}>
            {busy ? "Closing…" : "Close the claim"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddDocuments({ tripId, claimId }: { tripId: string; claimId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const body = new FormData();
    if (!(await photosForUpload(photos, body))) {
      setBusy(false);
      setError("Those photos are too big together. Send fewer at a time.");
      return;
    }
    const res = await fetch(`/api/trips/${tripId}/claims/${claimId}/documents`, { method: "POST", body }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const { error: message } = (await res?.json().catch(() => null)) ?? { error: null };
      setError(message ?? "Upload failed. Try again.");
      return;
    }
    setOpen(false);
    setPhotos([]);
    toast.success("Added to the claim.");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Add documents
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Add documents</DialogTitle>
        <DialogDescription className="text-[15px] text-slate">Photos of repair quotes, invoices or more damage.</DialogDescription>
        <PhotoPicker photos={photos} onChange={setPhotos} label="Pick photos" />
        <ErrorLine error={error} />
        <div className="grid grid-cols-2 gap-2">
          <DialogClose asChild>
            <Button variant="secondary">Back</Button>
          </DialogClose>
          <Button disabled={busy || photos.length === 0} onClick={submit}>
            {busy ? "Adding…" : "Add to the claim"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The host's next steps on one claim. */
export function ClaimActions({
  tripId,
  claimId,
  estimateCents,
  description,
  canAsk,
  canEscalate,
  canClose,
  canAddDocuments,
}: {
  tripId: string;
  claimId: string;
  estimateCents: number | null;
  description: string;
  canAsk: boolean;
  canEscalate: boolean;
  canClose: boolean;
  canAddDocuments: boolean;
}) {
  if (!canAsk && !canEscalate && !canClose && !canAddDocuments) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {canAsk && <AskGuestToPay tripId={tripId} claimId={claimId} estimateCents={estimateCents} description={description} />}
      {canEscalate && <Escalate tripId={tripId} claimId={claimId} />}
      {canAddDocuments && <AddDocuments tripId={tripId} claimId={claimId} />}
      {canClose && <CloseClaim tripId={tripId} claimId={claimId} />}
    </div>
  );
}
