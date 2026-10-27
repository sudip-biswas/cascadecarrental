import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConversationList } from "@/components/messaging/ConversationList";
import { ScheduledLink } from "@/components/messaging/scheduled/ScheduledTabs";
import { InboxShell } from "@/components/messaging/InboxShell";
import { MessageThread } from "@/components/messaging/MessageThread";
import { ThreadHeader } from "@/components/messaging/ThreadHeader";
import { listConversations, openConversation } from "@/components/messaging/inbox";
import { HOST_REPLIES } from "@/components/messaging/replies";

export const instant = false;
export const metadata = { title: "Inbox" };

export default async function HostConversationPage({ params }: PageProps<"/host/inbox/[conversationId]">) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`/host/inbox/${conversationId}`)}`);

  const conversation = await openConversation(supabase, conversationId, user.id);
  if (!conversation) notFound();
  if (conversation.role === "guest") redirect(`/messages/${conversationId}`);

  const conversations = await listConversations(supabase, user.id, "host");

  return (
    // Edge to edge on phones, where the thread is the whole screen.
    <div className="-mx-4 -mt-6 -mb-12 sm:-mx-7 sm:-mt-7 md:m-0">
      <InboxShell
        threadOpen
        className="md:h-[calc(100dvh-140px)] md:min-h-[560px] lg:h-[calc(100dvh-76px)]"
        list={
          <ConversationList
            conversations={conversations}
            activeId={conversationId}
            viewer="host"
            basePath="/host/inbox"
            className="h-full overflow-y-auto"
            action={<ScheduledLink />}
            empty="No other conversations."
          />
        }
        thread={
          <MessageThread
            key={conversationId}
            conversationId={conversationId}
            initialMessages={conversation.messages}
            currentUserId={user.id}
            otherName={conversation.other.full_name}
            basePath="/host/inbox"
            quickReplies={conversation.trip ? HOST_REPLIES : []}
            className="h-[calc(100dvh-64px)] rounded-none md:h-auto md:rounded-[28px]"
            header={
              <ThreadHeader
                otherName={conversation.other.full_name}
                trip={conversation.trip}
                viewer="host"
                backHref="/host/inbox"
              />
            }
          />
        }
      />
    </div>
  );
}
