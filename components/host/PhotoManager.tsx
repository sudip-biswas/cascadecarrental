"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CarPhoto } from "@/components/host/bits";
import type { VehicleImage } from "@/lib/supabase/types";

interface Props {
  vehicleId: string;
  initialPhotos: VehicleImage[];
}

async function readError(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  return typeof body?.error === "string" ? body.error : fallback;
}

export function PhotoManager({ vehicleId, initialPhotos }: Props) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState(
    [...initialPhotos].sort((a, b) => a.position - b.position)
  );
  const [uploading, setUploading] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Reorder ─────────────────────────────────────────────────────────────────

  async function move(id: string, dir: -1 | 1) {
    const idx = photos.findIndex((p) => p.id === id);
    const next = idx + dir;
    if (next < 0 || next >= photos.length) return;

    const reordered = [...photos];
    [reordered[idx], reordered[next]] = [reordered[next], reordered[idx]];
    setPhotos(reordered);

    setSaving(true);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: reordered.map((p) => p.id) }),
      });
      if (!res.ok) throw new Error(await readError(res, "Couldn't save order."));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save order.");
      setPhotos(photos); // revert
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async function deletePhoto(id: string) {
    setConfirmDelete(null);
    setDeleting(id);
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/images/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "Couldn't delete photo."));
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      toast.success("Photo deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete photo.");
    } finally {
      setDeleting(null);
    }
  }

  // ── Upload ───────────────────────────────────────────────────────────────────

  async function upload(files: FileList) {
    const list = Array.from(files);
    try {
      for (const [i, file] of list.entries()) {
        setUploading(`Uploading ${i + 1} of ${list.length}`);
        const form = new FormData();
        form.append("file", file);
        const up = await fetch("/api/uploads", { method: "POST", body: form });
        if (!up.ok) throw new Error(await readError(up, "Upload failed."));
        const { url } = await up.json();

        const saved = await fetch(`/api/vehicles/${vehicleId}/images`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        if (!saved.ok) throw new Error(await readError(saved, "Couldn't save photo."));
      }
      toast.success(list.length === 1 ? "Photo added" : `${list.length} photos added`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[26px]">
          Photos · {photos.length}
          {saving && <span className="ml-2 text-sm font-normal text-slate">Saving…</span>}
        </h2>
        <>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => e.target.files?.length && upload(e.target.files)}
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={!!uploading}
            onClick={() => fileInput.current?.click()}
          >
            <ImagePlus />
            {uploading ?? "Add photos"}
          </Button>
        </>
      </div>

      {photos.length > 0 && (
        <span className="text-sm text-slate">The first one is the cover.</span>
      )}

      {photos.length === 0 ? (
        <p className="rounded-[18px] bg-board p-3.5 text-[15px] text-slate">
          No photos yet. Guests skip cars without them.
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((p, i) => {
            const isDeleting = deleting === p.id;
            const isConfirming = confirmDelete === p.id;
            return (
              <div key={p.id} className="group relative">
                <CarPhoto
                  src={p.url}
                  alt={i === 0 ? "Cover photo" : `Photo ${i + 1}`}
                  sizes="120px"
                  className={cn(
                    "aspect-square w-full rounded-[14px] transition-opacity",
                    isDeleting && "opacity-30",
                    i === 0 && "ring-3 ring-ink"
                  )}
                />

                {/* Cover badge */}
                {i === 0 && (
                  <span className="pointer-events-none absolute top-1.5 left-1.5 rounded-[6px] bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Cover
                  </span>
                )}

                {/* Controls — visible on hover (or always while confirming/deleting) */}
                {!isDeleting && (
                  <div
                    className={cn(
                      "absolute inset-0 flex flex-col items-center justify-between rounded-[14px] p-1 transition-opacity",
                      isConfirming ? "opacity-100 bg-black/40" : "opacity-0 group-hover:opacity-100"
                    )}
                  >
                    {isConfirming ? (
                      /* Confirm delete overlay */
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5">
                        <span className="text-center text-[11px] font-bold text-white leading-tight">
                          Delete?
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => deletePhoto(p.id)}
                            className="rounded-[6px] bg-error px-2 py-1 text-[11px] font-bold text-white hover:bg-red-700"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="rounded-[6px] bg-white px-2 py-1 text-[11px] font-bold text-ink"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Move arrows row */}
                        <div className="flex w-full justify-between">
                          <button
                            type="button"
                            aria-label="Move left"
                            disabled={i === 0}
                            onClick={() => move(p.id, -1)}
                            className="rounded-[6px] bg-white/90 p-0.5 text-ink shadow disabled:opacity-0 hover:bg-white"
                          >
                            <ChevronLeft className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Move right"
                            disabled={i === photos.length - 1}
                            onClick={() => move(p.id, 1)}
                            className="rounded-[6px] bg-white/90 p-0.5 text-ink shadow disabled:opacity-0 hover:bg-white"
                          >
                            <ChevronRight className="size-3.5" />
                          </button>
                        </div>

                        {/* Delete button */}
                        <button
                          type="button"
                          aria-label="Delete photo"
                          onClick={() => setConfirmDelete(p.id)}
                          className="self-end rounded-[6px] bg-white/90 p-0.5 text-error shadow hover:bg-white"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
