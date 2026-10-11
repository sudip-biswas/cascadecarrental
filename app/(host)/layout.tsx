import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HostTopbar } from "@/components/layout/HostTopbar";
import { HostSidebar } from "@/components/layout/HostSidebar";

export const instant = false;

export default async function HostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/host/vehicles");
  }

  return (
    <div className="flex flex-col h-screen">
      <HostTopbar />
      <div className="flex flex-1 overflow-hidden">
        <HostSidebar />
        <main className="flex-1 overflow-y-auto bg-slate-50">{children}</main>
      </div>
    </div>
  );
}
