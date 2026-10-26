"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function NewPromoButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [form, setForm] = useState({
    code: "",
    description: "",
    off: "",
    maxRedemptions: "",
    perUserLimit: "1",
    minDays: "1",
    firstTripOnly: false,
    startsOn: "",
    endsOn: "",
  });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const off = num(form.off);
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/promos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: form.code,
        description: form.description || undefined,
        percentOff: kind === "percent" ? off : null,
        amountOffCents: kind === "amount" && off != null ? Math.round(off * 100) : null,
        maxRedemptions: num(form.maxRedemptions),
        perUserLimit: num(form.perUserLimit) ?? 1,
        minDays: num(form.minDays) ?? 1,
        firstTripOnly: form.firstTripOnly,
        startsOn: form.startsOn || null,
        endsOn: form.endsOn || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Couldn't create the code. Try again.");
      return;
    }
    toast.success(`${form.code.toUpperCase()} is live.`);
    setOpen(false);
    setForm({ ...form, code: "", description: "", off: "", maxRedemptions: "" });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New code
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogTitle>New promo code</DialogTitle>
        <DialogDescription className="text-[15px] text-slate">Guests type it at checkout. Leave a box empty for no limit.</DialogDescription>
        <form onSubmit={create} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="promo-code">Code</Label>
            <Input id="promo-code" value={form.code} onChange={set("code")} placeholder="WELCOME20" required className="uppercase" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="promo-description">What it&apos;s for (only staff see this)</Label>
            <Input id="promo-description" value={form.description} onChange={set("description")} placeholder="Newsletter, October" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={kind === "percent" ? "default" : "secondary"} onClick={() => setKind("percent")}>
              Percent off
            </Button>
            <Button type="button" variant={kind === "amount" ? "default" : "secondary"} onClick={() => setKind("amount")}>
              Dollars off
            </Button>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="promo-off">{kind === "percent" ? "Percent" : "Dollars"}</Label>
            <Input id="promo-off" inputMode="decimal" value={form.off} onChange={set("off")} placeholder={kind === "percent" ? "15" : "25"} required />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-max">Uses in total</Label>
              <Input id="promo-max" inputMode="numeric" value={form.maxRedemptions} onChange={set("maxRedemptions")} placeholder="No limit" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-per-user">Per person</Label>
              <Input id="promo-per-user" inputMode="numeric" value={form.perUserLimit} onChange={set("perUserLimit")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-min-days">Min days</Label>
              <Input id="promo-min-days" inputMode="numeric" value={form.minDays} onChange={set("minDays")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-start">Starts</Label>
              <Input id="promo-start" type="date" value={form.startsOn} onChange={set("startsOn")} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="promo-end">Ends after</Label>
              <Input id="promo-end" type="date" value={form.endsOn} onChange={set("endsOn")} />
            </div>
          </div>
          <Label className="flex items-center gap-2.5 text-[15px] font-semibold">
            <Checkbox checked={form.firstTripOnly} onCheckedChange={(v) => setForm({ ...form, firstTripOnly: v === true })} />
            First trip only
          </Label>
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
              {busy ? "Creating…" : "Create code"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PromoToggle({ promoId, code, active }: { promoId: string; code: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const res = await fetch(`/api/admin/promos/${promoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't save. Try again.");
      return;
    }
    toast.success(active ? `${code} is off.` : `${code} is back on.`);
    router.refresh();
  }

  return (
    <Button size="sm" variant={active ? "destructive" : "secondary"} disabled={busy} onClick={toggle}>
      {active ? "Deactivate" : "Turn back on"}
    </Button>
  );
}
