"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Phones: the trip panel folds out under the thread's top bar. */
export function PanelToggle({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="mx-3 mb-2 flex h-10 w-[calc(100%-1.5rem)] items-center justify-between rounded-[12px] bg-board px-3.5 text-sm font-bold"
      >
        {open ? "Hide details" : label}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} strokeWidth={2.2} />
      </button>
      {open && <div className="max-h-[55dvh] overflow-y-auto border-b border-line px-3 pb-3">{children}</div>}
    </div>
  );
}
