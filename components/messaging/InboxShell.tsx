import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * List beside thread on wide screens. On phones only one shows: the list on
 * the inbox page, the thread once one is open.
 */
export function InboxShell({
  list,
  thread,
  threadOpen,
  className,
}: {
  list: ReactNode;
  thread: ReactNode;
  threadOpen: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-stretch gap-3.5", className)}>
      <div className={cn("min-w-0 flex-[1_1_320px] md:block md:max-w-[400px]", threadOpen && "hidden")}>{list}</div>
      <div className={cn("min-w-0 flex-[999_1_520px] md:flex", threadOpen ? "flex" : "hidden")}>{thread}</div>
    </div>
  );
}

/** What the thread area shows on wide screens before a conversation is picked. */
export function NoThread({ children }: { children: ReactNode }) {
  return (
    <section className="flex flex-1 items-center justify-center rounded-[28px] bg-white p-8 text-center text-[15px] text-slate">
      {children}
    </section>
  );
}
