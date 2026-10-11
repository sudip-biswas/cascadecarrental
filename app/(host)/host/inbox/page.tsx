import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";

export const instant = false;

export const metadata = { title: "Messages" };

export default async function HostInboxPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conversations } = await supabase
    .from("conversations")
    .select(
      "*, guest:profiles!guest_id(id, full_name, avatar_url), host:profiles!host_id(id, full_name, avatar_url), messages(body, created_at, sender_id)"
    )
    .eq("host_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-cascade-900 mb-6">Messages</h1>

      {!conversations?.length ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No conversations yet.
        </div>
      ) : (
        <div className="space-y-2">
          {(conversations as any[]).map((conv) => {
            const guest = conv.guest;
            const lastMessage = conv.messages?.sort(
              (a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];

            return (
              <Link
                key={conv.id}
                href={`/host/inbox/${conv.id}`}
                className="flex items-center gap-4 border border-border rounded-xl p-4 hover:shadow-md transition-shadow bg-white"
              >
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarImage src={guest?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-cascade-100 text-cascade-700 font-semibold text-sm">
                    {guest?.full_name?.[0]?.toUpperCase() ?? "G"}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-semibold text-cascade-900 text-sm">
                      {guest?.full_name}
                    </p>
                    {lastMessage && (
                      <p className="text-xs text-muted-foreground shrink-0">
                        {formatDate(lastMessage.created_at, { month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {lastMessage
                      ? (lastMessage.sender_id === user.id ? "You: " : "") + lastMessage.body
                      : "No messages yet"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
