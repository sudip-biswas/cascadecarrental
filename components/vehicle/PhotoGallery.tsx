"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Grid2X2, X, ChevronLeft, ChevronRight } from "lucide-react";
import type { VehicleImage } from "@/types";

interface Props {
  images: VehicleImage[];
  vehicleName: string;
}

export function PhotoGallery({ images, vehicleName }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const cover = images.find((img) => img.is_cover) ?? images[0];
  const thumbs = images.filter((img) => img !== cover).slice(0, 2);

  function prev() {
    setCurrentIndex((i) => (i - 1 + images.length) % images.length);
  }

  function next() {
    setCurrentIndex((i) => (i + 1) % images.length);
  }

  if (!cover) {
    return (
      <div className="aspect-[16/9] bg-cascade-100 rounded-xl flex items-center justify-center">
        <span className="text-6xl">🚗</span>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 rounded-xl overflow-hidden">
        {/* Main image */}
        <div
          className="col-span-2 relative aspect-[16/10] cursor-pointer"
          onClick={() => { setCurrentIndex(0); setModalOpen(true); }}
        >
          <Image
            src={cover.url}
            alt={vehicleName}
            fill
            className="object-cover hover:brightness-95 transition-all"
            priority
            sizes="(max-width: 768px) 100vw, 60vw"
          />
        </div>

        {/* Thumbnails */}
        <div className="flex flex-col gap-2">
          {thumbs.map((img, i) => (
            <div
              key={img.id}
              className="relative flex-1 cursor-pointer"
              onClick={() => {
                setCurrentIndex(images.findIndex((x) => x.id === img.id));
                setModalOpen(true);
              }}
            >
              <Image
                src={img.url}
                alt={`${vehicleName} photo ${i + 2}`}
                fill
                className="object-cover hover:brightness-95 transition-all"
                sizes="20vw"
              />
            </div>
          ))}

          {images.length > 3 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 font-medium"
              onClick={() => { setCurrentIndex(0); setModalOpen(true); }}
            >
              <Grid2X2 className="w-3.5 h-3.5" />
              View {images.length} photos
            </Button>
          )}
        </div>
      </div>

      {/* Fullscreen modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-5xl p-0 bg-black">
          <div className="relative aspect-[4/3]">
            <Image
              src={images[currentIndex]?.url ?? cover.url}
              alt={vehicleName}
              fill
              className="object-contain"
              sizes="90vw"
            />

            <button
              className="absolute top-3 right-3 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition"
              onClick={() => setModalOpen(false)}
            >
              <X className="w-4 h-4" />
            </button>

            {images.length > 1 && (
              <>
                <button
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition"
                  onClick={prev}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition"
                  onClick={next}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                  {currentIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
