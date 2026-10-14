"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Deletes a car that has never been booked. Asks first, since it can't be undone. */
export function DeleteVehicleButton({ vehicleId, name }: { vehicleId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    const { data, error } = await createClient().from("vehicles").delete().eq("id", vehicleId).select("id");
    if (error || !data?.length) {
      setDeleting(false);
      toast.error("Couldn't delete it. Unlist it instead.");
      return;
    }
    toast.success(`${name} deleted`);
    router.replace("/host/vehicles");
    router.refresh();
  }

  return (
    <>
      <Button variant="destructive" className="h-[46px] rounded-[12px]" onClick={() => setOpen(true)}>
        Delete car
      </Button>
      <Dialog open={open} onOpenChange={(o) => !deleting && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription className="text-[15px] text-slate">
              The listing and its photos go for good. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={deleting} onClick={() => setOpen(false)}>
              Keep it
            </Button>
            <Button variant="destructive" disabled={deleting} onClick={remove}>
              {deleting ? "Deleting…" : "Delete car"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
