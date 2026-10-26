"use client";

import { cn } from "@/lib/utils";

/** On/off switch with a label, styled like the listed toggle on the car page. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-2.5 rounded-[14px] px-3.5 py-2.5 text-left text-[15px] font-bold transition-colors disabled:opacity-70",
        checked ? "bg-mint text-ink" : "bg-board text-ink hover:bg-line",
        className
      )}
    >
      <span
        className={cn(
          "relative inline-block h-[26px] w-11 shrink-0 rounded-[9px] transition-colors",
          checked ? "bg-ink" : "bg-[#c9ccd3]"
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] size-5 rounded-[7px] bg-white transition-[left]",
            checked ? "left-[21px]" : "left-[3px]"
          )}
        />
      </span>
      {label}
    </button>
  );
}
