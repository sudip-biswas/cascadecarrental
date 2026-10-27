import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConversationList } from "@/components/messaging/ConversationList";
import { ScheduledLink } from "@/components/messaging/scheduled/ScheduledTabs";
import { InboxShell, NoThread } from "@/components/messaging/InboxShell";
import { listConversations } from "@/components/messaging/inbox";

export const instant = false;
export const metadata = { title: "Inbox" };

export default async function HostInboxPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/inbox");

  const conversations = await listConversations(supabase, user.id, "host");

  return (
    <InboxShell
      threadOpen={false}
      className="md:h-[calc(100dvh-140px)] md:min-h-[560px] lg:h-[calc(100dvh-76px)]"
      list={
        <ConversationList
          conversations={conversations}
          viewer="host"
          basePath="/host/inbox"
          action={<ScheduledLink />}
          className="md:h-full md:overflow-y-auto"
          empty="Guests' questions and booking chats show up here."
        />
      }
      thread={
        <NoThread>
          {conversations.length ? "Pick a conversation to read it." : "No messages from guests yet."}
        </NoThread>
      }
    />
  );
}
