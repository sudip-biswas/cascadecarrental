import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Same width and gutters as the nav, so page content lines up under it. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1280px] px-4 sm:px-6", className)} {...props} />;
}

export type Tone = "white" | "board" | "sky" | "mint" | "butter" | "peach" | "lilac" | "ink";

export const toneClass: Record<Tone, string> = {
  white: "bg-white text-ink",
  board: "bg-board text-ink",
  sky: "bg-sky text-sky-ink",
  mint: "bg-mint text-mint-ink",
  butter: "bg-butter text-butter-ink",
  peach: "bg-peach text-peach-ink",
  lilac: "bg-lilac text-lilac-ink",
  ink: "bg-ink text-white",
};

/** The basic surface: a big rounded tile. No borders, no shadows. */
export function Tile({
  tone = "white",
  className,
  ...props
}: ComponentProps<"section"> & { tone?: Tone }) {
  return (
    <section className={cn("rounded-[28px] p-5 sm:p-[22px]", toneClass[tone], className)} {...props} />
  );
}

/** Small filled label, e.g. "Confirmed" or "Instant book". */
export function Tag({
  tone = "board",
  className,
  ...props
}: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 rounded-[8px] px-2 py-1 text-[13px] leading-none font-extrabold whitespace-nowrap",
        toneClass[tone],
        className
      )}
      {...props}
    />
  );
}

/** Page title block: big headline with an optional line under it. */
export function PageTitle({
  title,
  lead,
  action,
  size = "lg",
  className,
}: {
  title: ReactNode;
  lead?: ReactNode;
  action?: ReactNode;
  size?: "lg" | "md";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="flex min-w-0 flex-col gap-2">
        <h1
          className={cn(
            "headline",
            size === "lg" ? "text-[clamp(44px,6vw,72px)]" : "text-[clamp(36px,4.5vw,52px)]"
          )}
        >
          {title}
        </h1>
        {lead && <p className="max-w-[600px] text-[17px] text-slate">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

/** Small section heading inside a tile. */
export function TileTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 className={cn("text-[22px] leading-tight sm:text-[26px]", className)} {...props} />;
}

/** Label over a value, e.g. "Pick-up" / "Sat Oct 18 · 10:00". */
export function Fact({
  label,
  value,
  tone = "board",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 rounded-[14px] px-3 py-2.5", toneClass[tone], className)}>
      <span className="text-[12px] font-semibold opacity-75">{label}</span>
      <span className="text-[15px] leading-snug font-extrabold text-balance">{value}</span>
    </div>
  );
}

/** Money line in a price breakdown. */
export function PriceRow({
  label,
  value,
  strong,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "figures flex items-baseline justify-between gap-4",
        strong ? "font-display text-[22px] font-extrabold" : "text-[15px]",
        className
      )}
    >
      <span>{label}</span>
      <span className={strong ? undefined : "font-bold"}>{value}</span>
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block h-0.5 rounded-full bg-ink/10", className)} />;
}

/** What to show when a list is empty: a plain sentence and one next step. */
export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Tile className={cn("flex flex-col items-start gap-3 py-10 sm:px-8", className)}>
      {icon && (
        <span className="flex size-12 items-center justify-center rounded-[14px] bg-board [&_svg]:size-6">
          {icon}
        </span>
      )}
      <h2 className="text-[26px] leading-tight">{title}</h2>
      {body && <p className="max-w-[520px] text-[16px] text-slate">{body}</p>}
      {action}
    </Tile>
  );
}
