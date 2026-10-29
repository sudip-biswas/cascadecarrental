import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Where the trip panel joins the row: "xl" for the guest inbox, "wide" beside the host sidebar. */
export type PanelFrom = "xl" | "wide";

const SHOW_FROM: Record<PanelFrom, string> = { xl: "xl:block", wide: "min-[1440px]:block" };
// The list gives up some width to make room for the panel.
const LIST_NARROW: Record<PanelFrom, string> = { xl: "xl:max-w-[340px]", wide: "min-[1440px]:max-w-[320px]" };

/**
 * List beside thread on wide screens. On phones only one shows: the list on
 * the inbox page, the thread once one is open.
 */
export function InboxShell({
  list,
  thread,
  threadOpen,
  aside,
  asideFrom = "xl",
  className,
}: {
  list: ReactNode;
  thread: ReactNode;
  threadOpen: boolean;
  /** The trip panel, beside the thread once there's room for it. */
  aside?: ReactNode;
  asideFrom?: PanelFrom;
  className?: string;
}) {
  return (
    <div className={cn("flex items-stretch gap-3.5", className)}>
      <div className={cn("min-w-0 flex-[1_1_320px] md:block md:max-w-[400px]", aside && LIST_NARROW[asideFrom], threadOpen && "hidden")}>
        {list}
      </div>
      <div className={cn("min-w-0 flex-[999_1_520px] md:flex", threadOpen ? "flex" : "hidden")}>{thread}</div>
      {aside && (
        <aside className={cn("hidden w-[300px] flex-none overflow-y-auto rounded-[28px] bg-white p-4", SHOW_FROM[asideFrom])}>
          {aside}
        </aside>
      )}
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
