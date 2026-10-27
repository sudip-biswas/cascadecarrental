import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/kit";
import { BackLink } from "@/components/messaging/scheduled/ScheduledTabs";
import { TemplateForm } from "@/components/messaging/scheduled/TemplateForm";
import { loadCarOptions } from "../_cars";

export const instant = false;
export const metadata = { title: "Edit message template" };

export default async function EditTemplatePage({ params }: PageProps<"/host/inbox/scheduled/[templateId]">) {
  const { templateId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirectTo=/host/inbox/scheduled/${templateId}`);

  const [{ data: template }, cars] = await Promise.all([
    supabase.from("message_templates").select("*").eq("id", templateId).eq("host_id", user.id).maybeSingle(),
    loadCarOptions(supabase, user.id),
  ]);
  if (!template) notFound();

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <div className="flex flex-col gap-3">
        <BackLink href="/host/inbox/scheduled">Back to templates</BackLink>
        <PageTitle size="md" title={template.name} lead="Changes apply to messages that haven't gone out yet." />
      </div>
      <TemplateForm template={template} cars={cars} />
    </div>
  );
}
