"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toDateKey } from "@/lib/utils";

const EMPTY = { fullName: "", email: "", dateOfBirth: "", licenceLast4: "", licenceState: "", licenceExpiry: "" };

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className ?? "flex flex-col gap-1.5"}>
      <span className="text-[14px] font-semibold">{label}</span>
      {children}
    </label>
  );
}

/** "Add a driver": who they are and their licence, sent to the host to approve. */
export function DriverForm({ tripId, host, minAge, until }: { tripId: string; host: string; minAge: number; until: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const filled = Object.values(form).every((v) => v.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!filled) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/trips/${tripId}/drivers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setSaving(false);
    if (!res?.ok) {
      setError(data?.error ?? "Couldn't add the driver. Try again.");
      return;
    }
    setOpen(false);
    setForm(EMPTY);
    toast.success(`Sent to ${host}. ${form.fullName.trim().split(/\s+/)[0]} can drive once they approve.`);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" className="self-start">
          <UserPlus />
          Add a driver
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Add a driver</DialogTitle>
        <DialogDescription className="text-[15px] text-slate">
          {host} approves each driver. Drivers have to be {minAge} or older with a licence that&apos;s valid for the whole trip.
        </DialogDescription>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Full name, as on their licence">
            <Input value={form.fullName} onChange={set("fullName")} autoComplete="off" maxLength={120} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email">
              <Input type="email" value={form.email} onChange={set("email")} autoComplete="off" maxLength={254} />
            </Field>
            <Field label="Date of birth">
              <Input type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} max={toDateKey(new Date())} />
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_1fr] gap-3 sm:grid-cols-[1fr_0.8fr_1.4fr]">
            <Field label="Licence, last 4">
              <Input
                value={form.licenceLast4}
                onChange={(e) => setForm((f) => ({ ...f, licenceLast4: e.target.value.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() }))}
                placeholder="1234"
                inputMode="text"
                autoComplete="off"
              />
            </Field>
            <Field label="State">
              <Input
                value={form.licenceState}
                onChange={(e) => setForm((f) => ({ ...f, licenceState: e.target.value.replace(/[^a-z]/gi, "").slice(0, 2).toUpperCase() }))}
                placeholder="CA"
                autoComplete="off"
              />
            </Field>
            <Field label="Expires" className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
              <Input type="date" value={form.licenceExpiry} onChange={set("licenceExpiry")} min={until} />
            </Field>
          </div>
          <p className="text-[14px] text-slate">We only keep the last 4 characters of their licence number.</p>

          {error && (
            <p role="alert" className="rounded-[14px] bg-error-soft px-3.5 py-3 text-[15px] font-semibold text-error">
              {error}
            </p>
          )}

          <Button type="submit" disabled={!filled || saving} className="h-[48px] text-base">
            {saving ? "Sending…" : `Send to ${host}`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
