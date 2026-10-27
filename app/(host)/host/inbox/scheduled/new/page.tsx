import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/kit";
import { BackLink } from "@/components/messaging/scheduled/ScheduledTabs";
import { TemplateForm } from "@/components/messaging/scheduled/TemplateForm";
import { loadCarOptions } from "../_cars";

export const instant = false;
export const metadata = { title: "New message template" };

export default async function NewTemplatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/inbox/scheduled/new");

  const cars = await loadCarOptions(supabase, user.id);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <div className="flex flex-col gap-3">
        <BackLink href="/host/inbox/scheduled">Back to templates</BackLink>
        <PageTitle size="md" title="New template" lead="Write it once and every matching trip gets it at the right moment." />
      </div>
      <TemplateForm cars={cars} />
    </div>
  );
}
