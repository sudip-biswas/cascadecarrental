import Link from "next/link";
import { CalendarClock, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageTitle } from "@/components/kit";

/** Title, back link and the Templates / Upcoming tabs for the scheduled message pages. */
export function ScheduledHeader({ current, upcoming }: { current: "templates" | "upcoming"; upcoming: number }) {
  const tabs = [
    { key: "templates", label: "Templates", href: "/host/inbox/scheduled" },
    { key: "upcoming", label: upcoming ? `Upcoming · ${upcoming}` : "Upcoming", href: "/host/inbox/scheduled/upcoming" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <BackLink href="/host/inbox">Back to inbox</BackLink>
      <PageTitle
        title="Scheduled messages"
        lead="Messages that go out to guests on their own, at the right moment in each trip."
        action={
          <nav aria-label="Scheduled messages" className="flex max-w-full gap-1 overflow-x-auto rounded-[16px] bg-white p-[5px]">
            {tabs.map((tab) => {
              const on = tab.key === current;
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "flex h-11 shrink-0 items-center rounded-[12px] px-3.5 text-[15px] whitespace-nowrap transition-colors",
                    on ? "bg-ink font-bold text-white" : "font-semibold hover:bg-board"
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        }
      />
    </div>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex w-fit items-center gap-1 text-[15px] font-bold text-slate hover:text-ink">
      <ChevronLeft className="size-4" strokeWidth={2.5} />
      {children}
    </Link>
  );
}

/** The inbox's way in to scheduled messages, beside its title. */
export function ScheduledLink() {
  return (
    <Link
      href="/host/inbox/scheduled"
      className="flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] bg-board px-3 text-sm font-bold transition-colors hover:bg-line"
    >
      <CalendarClock className="size-4" strokeWidth={2} />
      Scheduled
    </Link>
  );
}
