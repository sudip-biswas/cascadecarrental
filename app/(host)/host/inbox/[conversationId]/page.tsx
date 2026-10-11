import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MessageThread } from "@/components/messaging/MessageThread";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const instant = false;

export default async function HostConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conv } = await supabase
    .from("conversations")
    .select(
      "*, guest:profiles!guest_id(id, full_name, avatar_url), messages(*)"
    )
    .eq("id", conversationId)
    .eq("host_id", user.id)
    .single();

  if (!conv) notFound();

  const c = conv as any;
  const guest = c.guest;
  const messages = (c.messages ?? []).sort(
    (a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-white">
        <Link href="/host/inbox" className="text-cascade-700 text-sm hover:underline">
          ←
        </Link>
        <Avatar className="w-8 h-8">
          <AvatarImage src={guest?.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs bg-cascade-100 text-cascade-700 font-semibold">
            {guest?.full_name?.[0]?.toUpperCase() ?? "G"}
          </AvatarFallback>
        </Avatar>
        <p className="font-semibold text-cascade-900 text-sm">{guest?.full_name}</p>
      </div>

      <MessageThread
        conversationId={conversationId}
        initialMessages={messages}
        currentUserId={user.id}
        recipientId={guest?.id}
        recipientName={guest?.full_name ?? "Guest"}
        recipientAvatar={guest?.avatar_url ?? null}
      />
    </div>
  );
}
