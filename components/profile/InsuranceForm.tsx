"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn, toDateKey } from "@/lib/utils";

export interface OwnInsurance {
  has_none: boolean;
  insurer: string | null;
  policy_number: string | null;
  expires_on: string | null;
  card_path: string | null;
  cardUrl: string | null;
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[14px] font-semibold">{label}</span>
      {children}
    </label>
  );
}

/** "Add insurance": the guest's own auto policy, or that they have none. Saved to their profile for every trip. */
export function InsuranceForm({
  insurance,
  label,
  variant = "secondary",
}: {
  insurance: OwnInsurance | null;
  label?: string;
  variant?: "default" | "secondary";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [none, setNone] = useState(false);
  const [insurer, setInsurer] = useState("");
  const [policy, setPolicy] = useState("");
  const [expires, setExpires] = useState("");
  const [card, setCard] = useState<File | null>(null);
  const [keepCard, setKeepCard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = toDateKey(new Date());
  const filled = none || (insurer.trim() && policy.trim() && expires);

  function reset(next: boolean) {
    setOpen(next);
    setError(null);
    if (!next) return;
    setNone(!!insurance?.has_none);
    setInsurer(insurance?.insurer ?? "");
    setPolicy(insurance?.policy_number ?? "");
    setExpires(insurance?.expires_on && insurance.expires_on >= today ? insurance.expires_on : "");
    setCard(null);
    setKeepCard(!!insurance?.card_path);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!filled) return;
    setSaving(true);
    setError(null);
    const body = new FormData();
    if (none) {
      body.set("none", "1");
    } else {
      body.set("insurer", insurer.trim());
      body.set("policy_number", policy.trim());
      body.set("expires_on", expires);
      if (card) body.set("card", card);
      else if (keepCard) body.set("keep_card", "1");
    }
    const res = await fetch("/api/insurance", { method: "POST", body }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setSaving(false);
    if (!res?.ok) {
      setError(data?.error ?? "Couldn't save your insurance. Try again.");
      return;
    }
    setOpen(false);
    toast.success(none ? "Saved. Pick a protection plan on each trip." : "Insurance saved.");
    router.refresh();
  }

  const has = insurance && !insurance.has_none;

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogTrigger asChild>
        <Button variant={variant} className="self-start">
          <ShieldCheck />
          {label ?? (has ? "Update insurance" : "Add insurance")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Your car insurance</DialogTitle>
        <DialogDescription className="text-[15px] text-slate">
          It&apos;s on your insurance card or in your insurer&apos;s app. Hosts see the insurer and the end date, never the
          policy number or the card.
        </DialogDescription>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex items-center gap-2.5 rounded-[14px] bg-board px-3.5 py-3 text-[15px] font-semibold">
            <input type="checkbox" checked={none} onChange={(e) => setNone(e.target.checked)} className="size-4 accent-ink" />
            I don&apos;t have car insurance
          </label>

          {none ? (
            <p className="text-[15px] text-slate">
              That&apos;s fine. Every trip then needs a protection plan, picked at checkout.
            </p>
          ) : (
            <>
              <Field label="Insurer">
                <Input value={insurer} onChange={(e) => setInsurer(e.target.value)} placeholder="GEICO" maxLength={120} autoComplete="off" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Policy number">
                  <Input value={policy} onChange={(e) => setPolicy(e.target.value)} maxLength={60} autoComplete="off" />
                </Field>
                <Field label="Policy ends">
                  <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} min={today} />
                </Field>
              </div>
              <Field label="Insurance card (optional)">
                <Input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif"
                  onChange={(e) => setCard(e.target.files?.[0] ?? null)}
                />
              </Field>
              {insurance?.card_path && !card && (
                <label className="flex items-center gap-2.5 text-[14px]">
                  <input type="checkbox" checked={keepCard} onChange={(e) => setKeepCard(e.target.checked)} className="size-4 accent-ink" />
                  Keep the card already on file
                  {insurance.cardUrl && (
                    <a href={insurance.cardUrl} target="_blank" rel="noreferrer" className="font-bold text-cobalt hover:underline">
                      See it
                    </a>
                  )}
                </label>
              )}
            </>
          )}

          {error && (
            <p role="alert" className="rounded-[14px] bg-error-soft px-3.5 py-3 text-[15px] font-semibold text-error">
              {error}
            </p>
          )}

          <Button type="submit" disabled={!filled || saving} className="h-[48px] text-base">
            {saving ? "Saving…" : "Save"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
