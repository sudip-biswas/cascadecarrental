"use client";

import { useRef } from "react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UPLOAD_MAX_BYTES } from "@/lib/licence";
import { shrinkPhoto } from "@/lib/shrink-photo";

const PHOTOS_MAX = 6;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

/**
 * Shrunk photos in a form body, or null if they still won't fit in one request.
 * A request over about 4.5 MB never reaches the server.
 */
export async function photosForUpload(photos: File[], body: FormData): Promise<boolean> {
  const small = await Promise.all(photos.map(shrinkPhoto));
  if (small.reduce((sum, f) => sum + f.size, 0) > UPLOAD_MAX_BYTES) return false;
  for (const file of small) body.append("photos", file);
  return true;
}

/** Up to 6 picked photos, with a remove button on each. */
export function PhotoPicker({ photos, onChange, label = "Add photos" }: { photos: File[]; onChange: (photos: File[]) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);

  function add(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (photos.length + files.length > PHOTOS_MAX) toast.error(`Up to ${PHOTOS_MAX} photos.`);
    onChange([...photos, ...files].slice(0, PHOTOS_MAX));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {photos.map((file, i) => (
        <span key={`${file.name}-${i}`} className="flex items-center gap-1 rounded-[10px] bg-white py-1.5 pr-1.5 pl-3 text-[13px] font-semibold">
          <span className="max-w-[140px] truncate">{file.name}</span>
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            onClick={() => onChange(photos.filter((_, j) => j !== i))}
            className="flex size-6 items-center justify-center rounded-full hover:bg-board"
          >
            <X className="size-3.5" strokeWidth={2.25} />
          </button>
        </span>
      ))}
      {photos.length < PHOTOS_MAX && (
        <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>
          <ImagePlus />
          {label}
        </Button>
      )}
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
