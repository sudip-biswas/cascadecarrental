"use client";
/* eslint-disable @next/next/no-img-element -- short-lived signed links, not optimisable */

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface GridPhoto {
  path: string;
  url: string | null;
}

/** A photo, or a plain stand-in when the browser can't show it (HEIC outside Safari, expired link). */
function Photo({ url, alt, className }: { url: string | null; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (!url || broken) {
    return (
      <span className={cn("flex items-center justify-center bg-board text-slate", className)}>
        <ImageOff className="size-6" strokeWidth={1.75} />
      </span>
    );
  }
  return <img src={url} alt={alt} className={cn("object-cover", className)} onError={() => setBroken(true)} />;
}

/** Thumbnails that open big in a dialog. */
export function PhotoGrid({ photos, label }: { photos: GridPhoto[]; label: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (photos.length === 0) return null;
  const current = open == null ? null : photos[open];
  const step = (by: number) => setOpen((i) => (i == null ? i : (i + by + photos.length) % photos.length));

  return (
    <>
      <div className="grid grid-cols-4 gap-1.5">
        {photos.map((photo, i) => (
          <button
            key={photo.path}
            type="button"
            onClick={() => setOpen(i)}
            className="overflow-hidden rounded-[12px] focus-visible:ring-2 focus-visible:ring-ink focus-visible:outline-none"
            aria-label={`Open ${label} photo ${i + 1}`}
          >
            <Photo url={photo.url} alt="" className="aspect-square w-full" />
          </button>
        ))}
      </div>

      <Dialog open={open != null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="gap-3 p-3 sm:max-w-3xl sm:p-4">
          <DialogTitle className="pr-12 pl-1 text-[17px]">
            {label}, photo {(open ?? 0) + 1} of {photos.length}
          </DialogTitle>
          {current && (
            <div className="relative">
              {current.url ? (
                <a href={current.url} target="_blank" rel="noreferrer">
                  <Photo
                    key={current.path}
                    url={current.url}
                    alt={`${label} photo ${(open ?? 0) + 1}`}
                    className="max-h-[75vh] w-full rounded-[18px] object-contain"
                  />
                </a>
              ) : (
                <Photo url={null} alt="" className="aspect-[4/3] w-full rounded-[18px]" />
              )}
              {photos.length > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="absolute top-1/2 left-2 -translate-y-1/2"
                    onClick={() => step(-1)}
                    aria-label="Previous photo"
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="absolute top-1/2 right-2 -translate-y-1/2"
                    onClick={() => step(1)}
                    aria-label="Next photo"
                  >
                    <ChevronRight />
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
