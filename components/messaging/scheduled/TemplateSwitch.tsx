"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { setTemplateActive } from "@/app/(host)/host/inbox/scheduled/actions";

/** The on/off switch on a template row. Turning one off drops its waiting messages. */
export function TemplateSwitch({ id, name, active }: { id: string; name: string; active: boolean }) {
  const [on, setOn] = useState(active);
  const [pending, start] = useTransition();

  function flip() {
    const next = !on;
    setOn(next);
    start(async () => {
      const { error } = await setTemplateActive(id, next);
      if (error) {
        setOn(!next);
        toast.error(error);
      } else {
        toast.success(next ? `"${name}" is on.` : `"${name}" is off. Nothing more goes out from it.`);
      }
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${name}: ${on ? "on" : "off"}`}
      disabled={pending}
      onClick={flip}
      className="relative inline-block h-[26px] w-11 shrink-0 rounded-[9px] transition-colors focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60"
    >
      <span aria-hidden className={cn("absolute inset-0 rounded-[9px] transition-colors", on ? "bg-ink" : "bg-[#e3e5ea]")} />
      <span
        aria-hidden
        className={cn("absolute top-[3px] size-5 rounded-[7px] bg-white transition-[left]", on ? "left-[21px]" : "left-[3px]")}
      />
    </button>
  );
}
