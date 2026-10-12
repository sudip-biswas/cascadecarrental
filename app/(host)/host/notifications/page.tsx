import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Bell } from "lucide-react";

export const instant = false;
export const metadata = { title: "Notifications" };

export default async function HostNotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold text-cascade-900 mb-6">Notifications</h1>
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <Bell className="w-10 h-10 opacity-30" />
        <p className="text-sm">No notifications yet.</p>
      </div>
    </div>
  );
}
