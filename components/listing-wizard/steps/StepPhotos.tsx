"use client";
/* eslint-disable @next/next/no-img-element -- local object URLs, not optimisable */

import { useDropzone, type FileRejection } from "react-dropzone";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { Tag, Tile, TileTitle } from "@/components/kit";
import { cn, pluralize } from "@/lib/utils";
import type { Errors, Photo, WizardData } from "../data";
import { LIMITS } from "@/lib/listing-limits";

interface Props {
  data: WizardData;
  errors: Errors;
  onChange: (updates: Partial<WizardData>) => void;
}

const SHOTS = ["Front corner", "Back corner", "Inside", "Dashboard", "Trunk"];

export function StepPhotos({ data, errors, onChange }: Props) {
  const { photos } = data;
  const room = LIMITS.photosMax - photos.length;

  function onDrop(files: File[], rejected: FileRejection[]) {
    if (rejected.length > 0) {
      toast.error(`${pluralize(rejected.length, "photo")} skipped: use JPG, PNG or WebP under 10 MB.`);
    }
    const added: Photo[] = files.slice(0, room).map((file) => ({
      id: crypto.randomUUID(),
      file,
      url: URL.createObjectURL(file),
    }));
    if (files.length > room) toast.error(`Up to ${LIMITS.photosMax} photos per car.`);
    if (added.length) onChange({ photos: [...photos, ...added] });
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxSize: LIMITS.photoMaxBytes,
    disabled: room <= 0,
  });

  function remove(id: string) {
    const photo = photos.find((p) => p.id === id);
    if (photo) URL.revokeObjectURL(photo.url);
    onChange({ photos: photos.filter((p) => p.id !== id) });
  }

  function makeCover(id: string) {
    const photo = photos.find((p) => p.id === id);
    if (photo) onChange({ photos: [photo, ...photos.filter((p) => p.id !== id)] });
  }

  const toGo = LIMITS.photosToList - photos.length;

  return (
    <>
      <Tile className={cn("grid grid-cols-2 gap-2.5 p-3.5 sm:grid-cols-4 sm:p-3.5", errors.photos && "bg-error-soft")}>
        {photos.map((photo, i) =>
          i === 0 ? (
            <div key={photo.id} className="relative col-span-2 row-span-2">
              <img
                src={photo.url}
                alt="Cover photo"
                className="aspect-[4/3] h-full w-full rounded-[20px] object-cover sm:aspect-auto sm:min-h-[300px]"
              />
              <Tag tone="ink" className="absolute top-2.5 left-2.5">
                Cover
              </Tag>
              <RemoveButton onClick={() => remove(photo.id)} />
            </div>
          ) : (
            <div key={photo.id} className="relative">
              <img src={photo.url} alt={`Photo ${i + 1}`} className="aspect-square w-full rounded-[18px] object-cover" />
              <RemoveButton onClick={() => remove(photo.id)} />
              <button
                type="button"
                onClick={() => makeCover(photo.id)}
                className="absolute bottom-2 left-2 rounded-[9px] bg-white px-2 py-1 text-[13px] font-bold transition-colors hover:bg-board"
              >
                Make cover
              </button>
            </div>
          )
        )}

        {room > 0 && (
          <div
            {...getRootProps({
              className: cn(
                "col-span-2 flex cursor-pointer items-center gap-3.5 rounded-[18px] p-[18px] text-sky-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ink",
                isDragActive ? "bg-[#b8d3fa]" : "bg-sky hover:bg-[#c2d9fd]",
                photos.length === 0 && "min-h-[220px] flex-col justify-center text-center sm:col-span-4"
              ),
            })}
          >
            <input {...getInputProps()} />
            <span className="flex size-[52px] shrink-0 items-center justify-center rounded-2xl bg-white">
              <Upload className="size-6 text-ink" strokeWidth={2} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[17px] font-extrabold text-ink">
                {photos.length ? "Drop more photos here" : "Drop photos here"}
              </span>
              <span className="text-sm">or tap to pick from your phone</span>
            </span>
          </div>
        )}
      </Tile>

      <div className="flex flex-wrap items-center gap-2 px-1 text-[15px]">
        {errors.photos ? (
          <span className="font-semibold text-error">{errors.photos}</span>
        ) : toGo > 0 ? (
          <>
            <Tag tone="butter">{pluralize(toGo, "more photo")} to go live</Tag>
            <span className="text-slate">With fewer than 3 the car is saved but hidden from guests.</span>
          </>
        ) : (
          <Tag tone="mint">Enough photos to go live</Tag>
        )}
        <span className="text-slate">Photos upload when you publish, so they aren&apos;t kept if you leave.</span>
      </div>

      <Tile className="flex flex-col gap-3.5">
        <TileTitle>Shots guests look for</TileTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {SHOTS.map((shot) => (
            <div key={shot} className="rounded-[18px] bg-board px-2.5 py-3.5 text-center text-sm font-bold">
              {shot}
            </div>
          ))}
        </div>
        <p className="text-[15px] text-slate">Daylight, outside, whole car in frame. Put your best one first.</p>
      </Tile>
    </>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="Remove photo"
      onClick={onClick}
      className="absolute top-2 right-2 flex size-[34px] items-center justify-center rounded-[10px] bg-white transition-colors hover:bg-board"
    >
      <X className="size-4" strokeWidth={2} />
    </button>
  );
}
