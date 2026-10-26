import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tile, TileTitle } from "@/components/kit";

export function Section({
  icon,
  iconTone,
  title,
  children,
}: {
  icon: ReactNode;
  iconTone: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Tile className="flex flex-col gap-4 sm:p-6">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-10 items-center justify-center rounded-[12px] [&_svg]:size-5", iconTone)}>
          {icon}
        </span>
        <TileTitle>{title}</TileTitle>
      </div>
      {children}
    </Tile>
  );
}

export function Choice({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex min-h-[96px] flex-col items-start justify-between gap-2.5 rounded-[20px] p-4 text-left transition-colors",
        on ? "bg-ink text-white" : "bg-board text-ink hover:bg-line"
      )}
    >
      {children}
    </button>
  );
}

/** A plain sentence in a soft tone: what's wrong, or what to know. */
export function Notice({ tone = "error", children }: { tone?: "error" | "peach" | "sky"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        "rounded-[14px] px-3.5 py-3 text-[15px] leading-[1.45]",
        tone === "error" && "bg-error-soft font-semibold text-error",
        tone === "peach" && "bg-peach text-peach-ink",
        tone === "sky" && "bg-sky text-sky-ink"
      )}
    >
      {children}
    </p>
  );
}
