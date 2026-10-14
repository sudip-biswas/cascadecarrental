import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHostNav } from "@/lib/account";
import { HostSidebar } from "@/components/layout/HostSidebar";
import { HostTopbar } from "@/components/layout/HostTopbar";
import { PhoneTabs } from "@/components/layout/PhoneTabs";

export const instant = false;

export default async function HostLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host");

  const { requests, unread } = await getHostNav(user.id);

  return (
    <div className="flex min-h-dvh flex-1">
      <HostSidebar requests={requests} unread={unread} />
      <div className="flex min-w-0 flex-1 flex-col">
        <HostTopbar />
        <main className="flex-1 px-4 pt-6 pb-12 sm:px-7 sm:pt-7">{children}</main>
        <PhoneTabs mode="host" inboxBadge={unread} todayBadge={requests} />
      </div>
    </div>
  );
}
