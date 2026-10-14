"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CarFront, ChevronLeft, ChevronRight, Share } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { VehicleImage } from "@/lib/supabase/types";

interface Props {
  images: VehicleImage[];
  vehicleName: string;
  backHref: string;
}

const overlayButton =
  "flex h-11 items-center gap-2 rounded-[12px] bg-white px-3.5 text-[15px] font-bold text-ink transition-colors hover:bg-board";

function ordered(images: VehicleImage[]) {
  return [...images].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.position - b.position);
}

export function PhotoGallery({ images, vehicleName, backHref }: Props) {
  const photos = ordered(images);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [phoneIndex, setPhoneIndex] = useState(0);

  function show(i: number) {
    setIndex(i);
    setOpen(true);
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: vehicleName, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      // Closing the share sheet isn't an error worth showing.
    }
  }

  const back = (
    <Link href={backHref} className={overlayButton} aria-label="Back to results">
      <ArrowLeft className="size-[18px]" strokeWidth={2} />
      <span className="hidden sm:inline">Results</span>
    </Link>
  );

  if (!photos.length) {
    return (
      <div className="relative flex aspect-[16/9] max-h-[420px] w-full items-center justify-center rounded-[32px] bg-line text-quiet">
        <CarFront className="size-16" strokeWidth={1.25} />
        <div className="absolute top-4 left-4">{back}</div>
      </div>
    );
  }

  const [main, ...rest] = photos;
  const side = rest.slice(0, 2);

  return (
    <>
      {/* Phone: swipe through every photo. */}
      <div className="relative -mx-4 sm:hidden">
        <div
          onScroll={(e) => {
            const el = e.currentTarget;
            setPhoneIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
          className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none]"
        >
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => show(i)}
              className="relative h-[300px] w-full shrink-0 snap-center overflow-hidden rounded-b-[30px]"
            >
              <Image
                src={photo.url}
                alt={`${vehicleName}, photo ${i + 1}`}
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>
        <div className="absolute top-3 left-4">{back}</div>
        <button type="button" onClick={share} className={cn(overlayButton, "absolute top-3 right-4 w-11 justify-center px-0")} aria-label="Share">
          <Share className="size-[18px]" strokeWidth={2} />
        </button>
        {photos.length > 1 && (
          <span className="absolute right-4 bottom-4 rounded-[10px] bg-white px-2.5 py-1.5 text-[13px] font-extrabold">
            {phoneIndex + 1} / {photos.length}
          </span>
        )}
      </div>

      {/* Larger screens: the cover with up to two more beside it. */}
      <div
        className={cn(
          "relative hidden gap-2.5 sm:grid sm:h-[420px] lg:h-[510px]",
          side.length ? "grid-cols-3 grid-rows-2" : "grid-cols-1"
        )}
      >
        <button
          type="button"
          onClick={() => show(0)}
          className={cn(
            "relative overflow-hidden",
            side.length ? "col-span-2 row-span-2 rounded-[32px_12px_12px_32px]" : "rounded-[32px]"
          )}
        >
          <Image src={main.url} alt={vehicleName} fill priority sizes="(max-width: 1280px) 66vw, 850px" className="object-cover" />
        </button>
        {side.map((photo, i) => (
          <button
            key={photo.id}
            type="button"
            onClick={() => show(i + 1)}
            className={cn(
              "relative overflow-hidden",
              side.length === 1
                ? "row-span-2 rounded-[12px_32px_32px_12px]"
                : i === 0
                  ? "rounded-[12px_32px_12px_12px]"
                  : "rounded-[12px_12px_32px_12px]"
            )}
          >
            <Image src={photo.url} alt={`${vehicleName}, photo ${i + 2}`} fill sizes="420px" className="object-cover" />
          </button>
        ))}
        <div className="absolute top-4 left-4">{back}</div>
        <button type="button" onClick={share} className={cn(overlayButton, "absolute top-4 right-4 w-11 justify-center px-0")} aria-label="Share">
          <Share className="size-[18px]" strokeWidth={2} />
        </button>
        {photos.length > 1 && (
          <button type="button" onClick={() => show(0)} className={cn(overlayButton, "absolute right-4 bottom-4")}>
            All {photos.length} photos
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(1100px,calc(100%-2rem))] gap-3 bg-ink p-3 text-white [&_[data-slot=dialog-close]]:bg-white sm:max-w-[min(1100px,calc(100%-2rem))]">
          <DialogTitle className="sr-only">{vehicleName} photos</DialogTitle>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[20px]">
            <Image
              src={photos[index]?.url ?? main.url}
              alt={`${vehicleName}, photo ${index + 1}`}
              fill
              sizes="90vw"
              className="object-contain"
            />
          </div>
          {photos.length > 1 && (
            <div className="flex items-center justify-between gap-3 px-1">
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => setIndex((i) => (i - 1 + photos.length) % photos.length)}
                className="flex size-11 items-center justify-center rounded-[12px] bg-graphite hover:bg-slate"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="figures text-sm font-bold">
                {index + 1} / {photos.length}
              </span>
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => setIndex((i) => (i + 1) % photos.length)}
                className="flex size-11 items-center justify-center rounded-[12px] bg-graphite hover:bg-slate"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
