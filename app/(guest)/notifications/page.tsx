import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient, getUser } from "@/lib/supabase/server";
import { NO_INDEX } from "@/lib/site";
import { Container, EmptyState, PageTitle, Tile } from "@/components/kit";
import { MarkRead } from "./_components/mark-read";
import { NoticeRow } from "./_components/notice-row";
import { isNew } from "./_components/notice-style";

export const instant = false;

export const metadata: Metadata = { title: "Notifications", ...NO_INDEX };

export default async function NotificationsPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login?redirectTo=/notifications");

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const notices = data ?? [];
  const now = new Date().getTime();
  const hasUnread = notices.some((n) => !n.read_at);

  return (
    <Container className="flex flex-col gap-[18px] pt-9 pb-16">
      <PageTitle title="Notifications" lead="Updates on your trips, as a guest and as a host." />
      {hasUnread && <MarkRead />}

      {notices.length === 0 ? (
        <EmptyState
          icon={<Bell strokeWidth={1.75} />}
          title="Nothing yet."
          body="Bookings, answers from hosts, reminders before pick-up and return, and receipts show up here. We email them too."
        />
      ) : (
        <Tile className="flex max-w-[760px] flex-col gap-1.5 p-3.5 sm:p-3.5">
          {notices.map((n) => (
            <NoticeRow key={n.id} notice={n} fresh={isNew(n, now)} now={now} />
          ))}
        </Tile>
      )}
    </Container>
  );
}
