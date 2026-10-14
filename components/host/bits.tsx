import Image from "next/image";
import { CarFront } from "lucide-react";
import { toneClass, type Tone } from "@/components/kit";
import { cn } from "@/lib/utils";

const INITIAL_TONES: Tone[] = ["lilac", "sky", "butter", "peach", "mint"];

/** A steady pastel per person, so the same guest always gets the same colour. */
export function toneFor(seed: string): Tone {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return INITIAL_TONES[hash % INITIAL_TONES.length];
}

export function firstName(fullName: string | null | undefined, fallback = "Guest") {
  return fullName?.trim().split(/\s+/)[0] || fallback;
}

/** A person's first initial on a rounded pastel tile. */
export function Initial({
  name,
  seed,
  tone,
  className,
}: {
  name: string | null | undefined;
  seed?: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[52px] shrink-0 items-center justify-center rounded-[16px] font-display text-[22px] font-extrabold",
        toneClass[tone ?? toneFor(seed ?? name ?? "?")],
        className
      )}
    >
      {(name?.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

type ImageRow = { url: string; is_cover: boolean; position?: number };

export function coverUrl(images: ImageRow[] | null | undefined): string | null {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return (sorted.find((i) => i.is_cover) ?? sorted[0]).url;
}

/** Car photo, or a quiet placeholder when there isn't one yet. */
export function CarPhoto({
  src,
  alt,
  sizes,
  className,
  priority,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <span className={cn("relative block overflow-hidden bg-line", className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-quiet">
          <CarFront className="size-8" strokeWidth={1.5} />
        </span>
      )}
    </span>
  );
}

export const STATUS_DOT: Record<string, { label: string; dot: string }> = {
  listed: { label: "Listed", dot: "bg-[#1f9d55]" },
  unlisted: { label: "Unlisted", dot: "bg-quiet" },
  suspended: { label: "Suspended", dot: "bg-error" },
};

/** Legend chip for the calendar colours. */
export function LegendItem({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-[4px]", swatch)} />
      {label}
    </span>
  );
}
