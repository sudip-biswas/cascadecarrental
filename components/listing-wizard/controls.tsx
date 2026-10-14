"use client";

import type { ComponentProps, ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import { cn, pluralize } from "@/lib/utils";

/** Label over an input on a grey inset, as in the listing boards. */
export function FieldBox({
  label,
  error,
  className,
  children,
}: {
  label: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label
        className={cn(
          "flex min-w-0 flex-col gap-0.5 rounded-2xl px-3.5 py-2.5 transition-colors focus-within:ring-2 focus-within:ring-ink",
          error ? "bg-error-soft" : "bg-board"
        )}
      >
        <span className="text-[13px] font-semibold text-slate">{label}</span>
        {children}
      </label>
      {error && <p className="px-1 text-[13px] font-semibold text-error">{error}</p>}
    </div>
  );
}

/** Bare input that sits inside a FieldBox. */
export function BoxInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "w-full min-w-0 bg-transparent p-0 text-[17px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-quiet",
        className
      )}
      {...props}
    />
  );
}

export function BoxSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn("w-full min-w-0 cursor-pointer bg-transparent p-0 text-[17px] font-semibold text-ink outline-none", className)}
      {...props}
    />
  );
}

export function BoxTextarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "field-sizing-content min-h-12 w-full resize-none bg-transparent p-0 text-base text-ink outline-none placeholder:text-quiet",
        className
      )}
      {...props}
    />
  );
}

/** − value + with a fixed step. */
export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  format,
  label,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  format: (value: number) => ReactNode;
  label: string;
  disabled?: boolean;
}) {
  const button =
    "flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-board transition-colors hover:bg-line disabled:opacity-40 disabled:hover:bg-board";
  return (
    <span className="flex items-center gap-2.5">
      <button
        type="button"
        aria-label={`Less: ${label}`}
        className={button}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        <Minus className="size-4" strokeWidth={2.5} />
      </button>
      <span className="figures min-w-16 text-center text-[17px] font-extrabold" aria-live="polite">
        {format(value)}
      </span>
      <button
        type="button"
        aria-label={`More: ${label}`}
        className={button}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        <Plus className="size-4" strokeWidth={2.5} />
      </button>
    </span>
  );
}

/** Square-cornered switch: ink when on, grey when off. */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-[18px] bg-white px-3.5 py-3 text-left disabled:opacity-60"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-base font-semibold">{label}</span>
        {hint && <span className="text-[13px] text-slate">{hint}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          "relative inline-block h-[26px] w-11 shrink-0 rounded-[9px] transition-colors",
          checked ? "bg-ink" : "bg-[#e3e5ea]"
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] size-5 rounded-[7px] bg-white transition-[left]",
            checked ? "left-[21px]" : "left-[3px]"
          )}
        />
      </span>
    </button>
  );
}

/** A white row inside a coloured tile: label on the left, control on the right. */
export function RuleRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] bg-white px-3.5 py-3">
      <span className="text-base font-semibold">{label}</span>
      {children}
    </div>
  );
}

const NOTICE_OPTIONS = [0, 1, 2, 3, 6, 12, 24, 48, 72, 168];

export function formatNotice(hours: number): string {
  if (hours === 0) return "None";
  if (hours === 168) return "1 week";
  if (hours >= 24 && hours % 24 === 0) return pluralize(hours / 24, "day");
  return pluralize(hours, "hour");
}

export function NoticeSelect({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (hours: number) => void;
  disabled?: boolean;
}) {
  const options = NOTICE_OPTIONS.includes(value) ? NOTICE_OPTIONS : [...NOTICE_OPTIONS, value].sort((a, b) => a - b);
  return (
    <select
      aria-label="Notice before pickup"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-[38px] cursor-pointer rounded-[10px] bg-board px-3 text-[15px] font-bold outline-none hover:bg-line focus-visible:ring-2 focus-visible:ring-ink"
    >
      {options.map((h) => (
        <option key={h} value={h}>
          {formatNotice(h)}
        </option>
      ))}
    </select>
  );
}

export const formatDays = (days: number) => pluralize(days, "day");
