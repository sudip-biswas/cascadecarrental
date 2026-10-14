import Link from "next/link";
import { cn } from "@/lib/utils";

interface MarkProps {
  size?: number;
  /** On dark backgrounds the tile lifts to graphite so it doesn't vanish. */
  onDark?: boolean;
  className?: string;
}

/** Three stacked bars on a rounded tile. */
export function LogoMark({ size = 38, onDark = false, className }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={cn("shrink-0", className)}>
      <rect width="48" height="48" rx="13" fill={onDark ? "#2B2D33" : "#111111"} />
      <rect x="8" y="10" width="21" height="8" rx="4" fill="#CFE2FF" />
      <rect x="14" y="20" width="21" height="8" rx="4" fill="#C9EED6" />
      <rect x="20" y="30" width="20" height="8" rx="4" fill="#FFE7A0" />
    </svg>
  );
}

interface Props {
  href?: string;
  size?: "sm" | "md";
  onDark?: boolean;
  className?: string;
}

export function Logo({ href = "/", size = "md", onDark = false, className }: Props) {
  return (
    <Link
      href={href}
      className={cn("flex shrink-0 items-center gap-2.5", onDark ? "text-white" : "text-ink", className)}
    >
      <LogoMark size={size === "md" ? 38 : 32} onDark={onDark} />
      <span
        className={cn(
          "font-display font-extrabold tracking-[-0.03em]",
          size === "md" ? "text-[27px]" : "text-[22px]"
        )}
      >
        Cascade
      </span>
    </Link>
  );
}
