"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Link2, Mail, Share2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { ListingReport } from "@/lib/supabase/types";
import { REPORT_REASONS } from "@/lib/listing-reports";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const pill =
  "flex h-11 items-center gap-2 rounded-[12px] bg-white px-3.5 text-[15px] font-bold transition-colors outline-none hover:bg-line focus-visible:ring-2 focus-visible:ring-cobalt";

/** Share the car (copy the link or email it) and flag it to Cascade. */
export function ShareReport({
  vehicleId,
  title,
  path,
  userId,
  isOwner,
}: {
  vehicleId: string;
  /** "2024 Toyota RAV4" */
  title: string;
  /** The car page path; the full link is built from the current origin. */
  path: string;
  userId: string | null;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ListingReport["reason"] | null>(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const link = () => `${window.location.origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link());
      toast.success("Link copied.");
    } catch {
      toast.error("Couldn't copy. Copy it from the address bar instead.");
    }
  }

  function email() {
    const subject = encodeURIComponent(`${title} on Cascade`);
    const body = encodeURIComponent(`Take a look at this ${title} on Cascade:\n\n${link()}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function startReport() {
    if (!userId) {
      router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    setOpen(true);
  }

  async function send() {
    if (!userId || !reason) return;
    setBusy(true);
    const { error } = await createClient()
      .from("listing_reports")
      .insert({ vehicle_id: vehicleId, reporter_id: userId, reason, details: details.trim() || null });
    setBusy(false);
    if (error && error.code !== "23505") {
      toast.error("Couldn't send that. Try again.");
      return;
    }
    setOpen(false);
    setReason(null);
    setDetails("");
    toast.success(error ? "You've already reported this car. We're looking at it." : "Thanks. Cascade will take a look.");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger className={pill}>
          <Share2 className="size-[18px]" strokeWidth={2} />
          Share
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 p-1.5">
          <DropdownMenuItem onSelect={copy} className="gap-2.5 rounded-[12px] px-3 py-2.5 text-[15px] font-semibold">
            <Link2 className="size-[18px]" strokeWidth={1.75} />
            Copy link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={email} className="gap-2.5 rounded-[12px] px-3 py-2.5 text-[15px] font-semibold">
            <Mail className="size-[18px]" strokeWidth={1.75} />
            Email
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {!isOwner && (
        <button type="button" onClick={startReport} className={cn(pill, "font-semibold text-slate hover:text-ink")}>
          <Flag className="size-[18px]" strokeWidth={2} />
          Report listing
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>What&apos;s wrong with this listing?</DialogTitle>
          <DialogDescription className="text-[15px] text-slate">
            Cascade staff read every report. The host isn&apos;t told who sent it.
          </DialogDescription>
          <div role="radiogroup" aria-label="Reason" className="grid gap-1.5">
            {REPORT_REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={reason === r.value}
                onClick={() => setReason(r.value)}
                className={cn(
                  "rounded-[14px] px-4 py-3 text-left text-[15px] font-semibold transition-colors",
                  reason === r.value ? "bg-ink text-white" : "bg-board hover:bg-line"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Textarea
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={1000}
            aria-label="Anything else"
            placeholder="Anything that helps us check, e.g. the plate in the photos is different."
          />
          <div className="grid grid-cols-2 gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Never mind</Button>
            </DialogClose>
            <Button disabled={busy || !reason} onClick={send}>
              {busy ? "Sending…" : "Send report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
