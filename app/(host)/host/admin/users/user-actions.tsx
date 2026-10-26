"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Props {
  userId: string;
  name: string;
  licenceVerified: boolean;
  identityVerified: boolean;
  suspended: boolean;
  cars: number;
  self: boolean;
}

export function UserActions({ userId, name, licenceVerified, identityVerified, suspended, cars, self }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function save(change: Record<string, boolean>, done: string) {
    setBusy(true);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Couldn't save. Try again.");
      return;
    }
    setOpen(false);
    toast.success(done);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => save({ licenceVerified: !licenceVerified }, licenceVerified ? "Licence check removed." : "Licence marked checked.")}
      >
        {licenceVerified ? "Unmark licence" : "Mark licence checked"}
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => save({ identityVerified: !identityVerified }, identityVerified ? "ID check removed." : "ID marked checked.")}
      >
        {identityVerified ? "Unmark ID" : "Mark ID checked"}
      </Button>
      {suspended ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => save({ suspended: false }, `${name} can use Cascade again.`)}>
          Lift suspension
        </Button>
      ) : (
        !self && (
          <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
            <DialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={busy}>
                Suspend
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>Suspend {name}?</DialogTitle>
              <DialogDescription className="text-[15px] text-slate">
                {cars > 0
                  ? `Their ${cars === 1 ? "car comes" : `${cars} cars come`} off search straight away. Trips already booked aren't cancelled; do that from Trips if you need to.`
                  : "Trips already booked aren't cancelled; do that from Trips if you need to."}
              </DialogDescription>
              <div className="grid grid-cols-2 gap-2">
                <DialogClose asChild>
                  <Button variant="secondary" disabled={busy}>
                    Back
                  </Button>
                </DialogClose>
                <Button variant="destructive" disabled={busy} onClick={() => save({ suspended: true }, `${name} is suspended.`)}>
                  {busy ? "Suspending…" : "Suspend"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )
      )}
    </div>
  );
}
