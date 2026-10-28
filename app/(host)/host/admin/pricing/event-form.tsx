"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewEventButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", startsOn: "", endsOn: "", pct: "10" });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/pricing-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        startsOn: form.startsOn,
        endsOn: form.endsOn || form.startsOn,
        pct: Number(form.pct),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't add the event. Try again.");
      return;
    }
    toast.success(`${form.name} added. Automatic prices are updated.`);
    setOpen(false);
    setForm({ name: "", startsOn: "", endsOn: "", pct: "10" });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New event
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>New pricing event</DialogTitle>
        <DialogDescription className="text-[15px] text-slate">
          Moves the price of every car on automatic pricing for these days. Hosts&apos; own prices stay as they are.
        </DialogDescription>
        <form onSubmit={create} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-name">Name</Label>
            <Input id="event-name" value={form.name} onChange={set("name")} placeholder="Seahawks home game" required maxLength={80} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-start">First day</Label>
              <Input id="event-start" type="date" value={form.startsOn} onChange={set("startsOn")} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="event-end">Last day</Label>
              <Input id="event-end" type="date" value={form.endsOn} onChange={set("endsOn")} placeholder="Same day" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-pct">Percent, -30 to 50</Label>
            <Input id="event-pct" inputMode="numeric" value={form.pct} onChange={set("pct")} required />
          </div>
          {error && (
            <p role="alert" className="rounded-[14px] bg-error-soft px-3.5 py-3 text-[15px] font-semibold text-error">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={busy}>
                Back
              </Button>
            </DialogClose>
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteEventButton({ eventId, name }: { eventId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    const res = await fetch(`/api/admin/pricing-events/${eventId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't remove it. Try again.");
      return;
    }
    toast.success(`${name} removed.`);
    router.refresh();
  }

  return (
    <Button size="sm" variant="secondary" disabled={busy} onClick={remove}>
      Remove
    </Button>
  );
}
