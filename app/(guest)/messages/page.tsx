import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Container } from "@/components/kit";
import { ConversationList } from "@/components/messaging/ConversationList";
import { InboxShell, NoThread } from "@/components/messaging/InboxShell";
import { listConversations } from "@/components/messaging/inbox";

export const instant = false;
export const metadata = { title: "Inbox" };

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/messages");

  const conversations = await listConversations(supabase, user.id, "guest");

  return (
    <Container className="py-4 md:py-6">
      <InboxShell
        threadOpen={false}
        className="md:h-[calc(100dvh-118px)] md:min-h-[560px]"
        list={
          <ConversationList
            conversations={conversations}
            viewer="guest"
            basePath="/messages"
            className="md:h-full md:overflow-y-auto"
            empty={
              <>
                Nothing here yet. You can message a host from any car page.{" "}
                <Link href="/search" className="font-bold text-ink hover:text-cobalt">
                  Find a car
                </Link>
              </>
            }
          />
        }
        thread={
          <NoThread>
            {conversations.length ? "Pick a conversation to read it." : "Your conversations with hosts show up here."}
          </NoThread>
        }
      />
    </Container>
  );
}
