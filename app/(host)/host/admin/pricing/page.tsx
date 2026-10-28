import { Sparkles } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { NO_INDEX } from "@/lib/site";
import { formatRange, pluralize, toDateKey, zonedInstant } from "@/lib/utils";
import { holidaysOn, type PricingEvent } from "@/lib/auto-pricing";
import { addDays } from "@/components/host/days";
import { EmptyState, PageTitle, Tag, Tile } from "@/components/kit";
import { requireAdminPage } from "../_lib/admin";
import { DeleteEventButton, NewEventButton } from "./event-form";

export const instant = false;
export const metadata = { title: "Pricing events · Admin", ...NO_INDEX };

const pctLabel = (pct: number) => `${pct > 0 ? "+" : ""}${pct}%`;
const range = (e: PricingEvent) =>
  e.starts_on === e.ends_on
    ? formatRange(zonedInstant(e.starts_on), zonedInstant(e.starts_on))
    : formatRange(zonedInstant(e.starts_on), zonedInstant(e.ends_on));

/** The holidays automatic pricing knows on its own, over the next year. */
function comingHolidays(today: string): PricingEvent[] {
  const seen = new Map<string, PricingEvent>();
  for (let i = 0; i < 366; i++) {
    for (const h of holidaysOn(addDays(today, i))) seen.set(`${h.name} ${h.starts_on}`, h);
  }
  return [...seen.values()].sort((a, b) => a.starts_on.localeCompare(b.starts_on));
}

export default async function AdminPricingPage() {
  await requireAdminPage("/host/admin/pricing");
  const today = toDateKey(new Date());
  const admin = createAdminClient();
  const [{ data: events }, { count: autoCars }] = await Promise.all([
    admin.from("pricing_events").select("*").gte("ends_on", today).order("starts_on"),
    admin.from("vehicles").select("id", { count: "exact", head: true }).eq("auto_pricing", true),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4">
      <PageTitle
        title="Pricing events"
        lead={`Dates that raise or lower automatic prices across Seattle, like game days and festivals. ${pluralize(autoCars ?? 0, "car")} on automatic pricing.`}
        action={<NewEventButton />}
      />

      {!events?.length && (
        <EmptyState icon={<Sparkles />} title="No events coming up." body="Add a Seahawks home game, a big concert or a convention week." />
      )}

      {!!events?.length && (
        <Tile className="flex flex-col gap-1 p-2 sm:p-2">
          {events.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] px-3.5 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[17px] font-extrabold">{e.name}</span>
                  <Tag tone={e.pct > 0 ? "mint" : "butter"}>{pctLabel(e.pct)}</Tag>
                </div>
                <span className="text-[14px] text-slate">{range(e)}</span>
              </div>
              <DeleteEventButton eventId={e.id} name={e.name} />
            </div>
          ))}
        </Tile>
      )}

      <Tile className="flex flex-col gap-2">
        <h2 className="text-[22px]">Holidays, built in</h2>
        <p className="text-[15px] text-slate">
          These count without a row. When a holiday and an event share a day, the bigger one wins.
        </p>
        <div className="flex flex-col">
          {comingHolidays(today).map((h) => (
            <div key={`${h.name} ${h.starts_on}`} className="flex items-center justify-between gap-3 border-t border-line py-2 first:border-t-0">
              <span className="font-bold">{h.name}</span>
              <span className="flex items-center gap-2 text-[14px] text-slate">
                {range(h)} <Tag tone="mint">{pctLabel(h.pct)}</Tag>
              </span>
            </div>
          ))}
        </div>
      </Tile>
    </div>
  );
}
