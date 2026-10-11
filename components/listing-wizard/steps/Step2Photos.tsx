"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import Image from "next/image";
import { X, Upload, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WizardData } from "../WizardShell";

interface Props {
  data: WizardData;
  onChange: (updates: Partial<WizardData>) => void;
}

export function Step2Photos({ data, onChange }: Props) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newImages = acceptedFiles.map((file, i) => ({
        file,
        url: URL.createObjectURL(file),
        isCover: data.images.length === 0 && i === 0,
      }));
      onChange({ images: [...data.images, ...newImages] });
    },
    [data.images, onChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"] },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  function removeImage(index: number) {
    const updated = data.images.filter((_, i) => i !== index);
    if (updated.length > 0 && !updated.some((img) => img.isCover)) {
      updated[0].isCover = true;
    }
    onChange({ images: updated });
  }

  function setCover(index: number) {
    onChange({
      images: data.images.map((img, i) => ({ ...img, isCover: i === index })),
    });
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-cascade-900">Photos</h2>
      <p className="text-sm text-muted-foreground">
        Add at least 3 photos. The first photo (or the one you mark as cover) will be
        the main listing image.
      </p>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive
            ? "border-cascade-500 bg-cascade-100"
            : "border-border hover:border-cascade-300"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 text-cascade-500 mx-auto mb-3" />
        <p className="text-sm font-medium text-cascade-900">
          {isDragActive ? "Drop photos here" : "Drag & drop photos or click to browse"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          JPG, PNG, WebP up to 10MB each
        </p>
      </div>

      {/* Image grid */}
      {data.images.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {data.images.map((img, i) => (
            <div key={img.url} className="relative group aspect-[4/3] rounded-lg overflow-hidden">
              <Image
                src={img.url}
                alt={`Photo ${i + 1}`}
                fill
                className="object-cover"
                sizes="200px"
              />

              {/* Cover badge */}
              {img.isCover && (
                <div className="absolute top-2 left-2 bg-cascade-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  Cover
                </div>
              )}

              {/* Actions */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                {!img.isCover && (
                  <button
                    onClick={() => setCover(i)}
                    className="bg-white/90 text-cascade-900 text-[10px] font-semibold px-2 py-1 rounded flex items-center gap-1"
                  >
                    <Star className="w-3 h-3" /> Set cover
                  </button>
                )}
                <button
                  onClick={() => removeImage(i)}
                  className="bg-white/90 text-ember-500 p-1 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.images.length < 3 && (
        <p className="text-xs text-summit-500 font-medium">
          Please add at least {3 - data.images.length} more photo
          {3 - data.images.length > 1 ? "s" : ""}.
        </p>
      )}
    </div>
  );
}
