import Link from "next/link";
import type { Notification } from "@/lib/supabase/types";
import { toneClass } from "@/components/kit";
import { cn } from "@/lib/utils";
import { noticeStyle, noticeTime } from "./notice-style";

/** One notification in a feed. New ones get a fill and a dot. */
export function NoticeRow({ notice, fresh, now }: { notice: Notification; fresh: boolean; now: number }) {
  const { icon: Icon, tone } = noticeStyle(notice.kind);
  const firstLine = notice.body?.split("\n")[0];
  const content = (
    <>
      <span className={cn("flex size-[46px] flex-none items-center justify-center rounded-[14px]", toneClass[tone])}>
        <Icon className="size-[22px]" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn("text-base", fresh ? "font-extrabold" : "font-bold")}>{notice.title}</span>
        <span className="truncate text-sm text-slate">
          {[noticeTime(notice.created_at, now), firstLine].filter(Boolean).join(" · ")}
        </span>
      </span>
      {fresh && (
        <span className="size-2.5 flex-none rounded-[5px] bg-cobalt">
          <span className="sr-only">New</span>
        </span>
      )}
    </>
  );
  const className = cn(
    "flex items-center gap-3.5 rounded-[18px] p-3.5 transition-colors",
    fresh ? "bg-board hover:bg-line" : "hover:bg-board"
  );

  return notice.href ? (
    <Link href={notice.href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
