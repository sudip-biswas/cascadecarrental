import { notFound, redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { NO_INDEX } from "@/lib/site";
import { Container } from "@/components/kit";
import { ConversationList } from "@/components/messaging/ConversationList";
import { InboxShell } from "@/components/messaging/InboxShell";
import { MessageThread } from "@/components/messaging/MessageThread";
import { ThreadHeader } from "@/components/messaging/ThreadHeader";
import { TripPanel, loadPanel } from "@/components/messaging/TripPanel";
import { listConversations, openConversation } from "@/components/messaging/inbox";
import { GUEST_REPLIES } from "@/components/messaging/replies";

export const instant = false;
export const metadata = { title: "Inbox", ...NO_INDEX };

export default async function ConversationPage({ params }: PageProps<"/messages/[conversationId]">) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`/messages/${conversationId}`)}`);

  const conversation = await openConversation(supabase, conversationId, user.id);
  if (!conversation) notFound();
  // Host-side conversations live in the hosting inbox.
  if (conversation.role === "host") redirect(`/host/inbox/${conversationId}`);

  const [conversations, panel] = await Promise.all([
    listConversations(supabase, user.id, "guest"),
    loadPanel(conversation),
  ]);

  return (
    <Container className="px-0 sm:px-0 md:px-6 md:py-6">
      <InboxShell
        threadOpen
        aside={<TripPanel data={panel} />}
        asideFrom="xl"
        className="md:h-[calc(100dvh-118px)] md:min-h-[560px]"
        list={
          <ConversationList
            conversations={conversations}
            activeId={conversationId}
            viewer="guest"
            basePath="/messages"
            className="h-full overflow-y-auto"
            empty="No other conversations."
          />
        }
        thread={
          <MessageThread
            key={conversationId}
            conversationId={conversationId}
            initialMessages={conversation.messages}
            initialPhotoUrls={conversation.photoUrls}
            currentUserId={user.id}
            otherName={conversation.other.full_name}
            basePath="/messages"
            quickReplies={conversation.trip ? GUEST_REPLIES : []}
            className="h-[calc(100dvh-70px)] rounded-none md:h-auto md:rounded-[28px]"
            header={
              <ThreadHeader
                otherName={conversation.other.full_name}
                trip={conversation.trip}
                viewer="guest"
                backHref="/messages"
                panel={<TripPanel data={panel} />}
                panelBeside="xl"
              />
            }
          />
        }
      />
    </Container>
  );
}
