"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

async function readError(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

/** Uploads photos to a car that's already listed. */
export function AddPhotos({ vehicleId }: { vehicleId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function upload(files: FileList) {
    const list = Array.from(files);
    try {
      for (const [i, file] of list.entries()) {
        setProgress(`Uploading ${i + 1} of ${list.length}`);
        const form = new FormData();
        form.append("file", file);
        const uploaded = await fetch("/api/uploads", { method: "POST", body: form });
        if (!uploaded.ok) throw new Error(await readError(uploaded, "Upload failed. Try again."));
        const { url } = await uploaded.json();

        const saved = await fetch(`/api/vehicles/${vehicleId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (!saved.ok) throw new Error(await readError(saved, "Couldn't save the photo."));
      }
      toast.success(list.length === 1 ? "Photo added" : `${list.length} photos added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setProgress(null);
      if (input.current) input.current.value = "";
      router.refresh();
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => e.target.files?.length && upload(e.target.files)}
      />
      <Button variant="secondary" size="sm" disabled={!!progress} onClick={() => input.current?.click()}>
        <ImagePlus />
        {progress ?? "Add photos"}
      </Button>
    </>
  );
}
