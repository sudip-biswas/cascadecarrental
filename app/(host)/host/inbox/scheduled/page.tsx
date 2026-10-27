import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { describeSchedule, TRIP_TYPES } from "@/lib/scheduled-messages";
import { pluralize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState, Tag, Tile } from "@/components/kit";
import { ScheduledHeader } from "@/components/messaging/scheduled/ScheduledTabs";
import { TemplateSwitch } from "@/components/messaging/scheduled/TemplateSwitch";

export const instant = false;
export const metadata = { title: "Scheduled messages" };

export default async function MessageTemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/inbox/scheduled");

  const [{ data: templates }, { count: cars }, { count: upcoming }] = await Promise.all([
    supabase.from("message_templates").select("*").eq("host_id", user.id).order("created_at", { ascending: true }),
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("host_id", user.id),
    supabase
      .from("scheduled_messages")
      .select("id", { count: "exact", head: true })
      .eq("host_id", user.id)
      .eq("status", "scheduled"),
  ]);

  const newButton = (
    <Button asChild>
      <Link href="/host/inbox/scheduled/new">
        <Plus strokeWidth={2.25} />
        New template
      </Link>
    </Button>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <ScheduledHeader current="templates" upcoming={upcoming ?? 0} />

      {!templates?.length ? (
        <EmptyState
          icon={<CalendarClock strokeWidth={1.75} />}
          title="No templates yet"
          body="Write a message once, pick when it goes out, like right after a booking or two hours before the trip ends, and every guest gets it on time."
          action={newButton}
        />
      ) : (
        <Tile className="flex flex-col gap-1 sm:p-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[26px] leading-tight">Templates</h2>
            {newButton}
          </div>
          <div
            aria-hidden
            className="hidden grid-cols-[minmax(0,1fr)_220px_90px_52px] gap-4 px-3 pb-1 text-[12px] font-bold tracking-[0.06em] text-quiet uppercase md:grid"
          >
            <span>Message</span>
            <span>Goes out</span>
            <span>Cars</span>
            <span>On</span>
          </div>
          <ul className="flex flex-col gap-1">
            {templates.map((t) => {
              const carCount = t.vehicle_ids ? t.vehicle_ids.length : (cars ?? 0);
              const type = t.trip_type === "all" ? null : TRIP_TYPES.find((x) => x.value === t.trip_type)?.label;
              return (
                <li
                  key={t.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-[18px] p-3 transition-colors hover:bg-board md:grid-cols-[minmax(0,1fr)_220px_90px_52px]"
                >
                  <Link href={`/host/inbox/scheduled/${t.id}`} className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2 text-base font-extrabold">
                      {t.name}
                      {type && <Tag tone="sky">{type}</Tag>}
                    </span>
                    <span className="truncate text-[15px] text-slate">{t.body}</span>
                  </Link>
                  <span className="col-start-1 row-start-2 text-sm text-slate md:col-start-auto md:row-start-auto md:text-[15px] md:text-ink">
                    {describeSchedule(t)}
                    <span className="md:hidden"> · {t.vehicle_ids ? pluralize(carCount, "car") : "All cars"}</span>
                  </span>
                  <span className="figures hidden text-[15px] font-bold md:block">
                    {t.vehicle_ids ? carCount : `All ${carCount}`}
                  </span>
                  <span className="col-start-2 row-span-2 row-start-1 md:col-start-auto md:row-span-1 md:row-start-auto">
                    <TemplateSwitch id={t.id} name={t.name} active={t.active} />
                  </span>
                </li>
              );
            })}
          </ul>
        </Tile>
      )}
    </div>
  );
}
