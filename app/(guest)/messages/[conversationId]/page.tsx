import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MessageThread } from "@/components/messaging/MessageThread";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const instant = false;

export default async function ConversationPage({
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
      "*, guest:profiles!guest_id(id, full_name, avatar_url), host:profiles!host_id(id, full_name, avatar_url), messages(*, profiles!sender_id(full_name, avatar_url))"
    )
    .eq("id", conversationId)
    .or(`guest_id.eq.${user.id},host_id.eq.${user.id}`)
    .single();

  if (!conv) notFound();

  const c = conv as any;
  const other = c.guest_id === user.id ? c.host : c.guest;

  const messages = (c.messages ?? []).sort(
    (a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-5rem)] flex flex-col border-x border-border">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-white">
        <Link href="/messages" className="text-cascade-700 text-sm hover:underline">
          ←
        </Link>
        <Avatar className="w-8 h-8">
          <AvatarImage src={other?.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs bg-cascade-100 text-cascade-700 font-semibold">
            {other?.full_name?.[0]?.toUpperCase() ?? "?"}
          </AvatarFallback>
        </Avatar>
        <p className="font-semibold text-cascade-900 text-sm">{other?.full_name}</p>
      </div>

      <MessageThread
        conversationId={conversationId}
        initialMessages={messages}
        currentUserId={user.id}
        recipientId={other?.id}
        recipientName={other?.full_name ?? "User"}
        recipientAvatar={other?.avatar_url ?? null}
      />
    </div>
  );
}
