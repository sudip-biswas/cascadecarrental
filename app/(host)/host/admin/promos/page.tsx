import { TicketPercent } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { NO_INDEX } from "@/lib/site";
import { formatCurrency, formatDate, pluralize } from "@/lib/utils";
import type { PromoCode } from "@/lib/supabase/types";
import { EmptyState, PageTitle, Tag, Tile, type Tone } from "@/components/kit";
import { requireAdminPage } from "../_lib/admin";
import { NewPromoButton, PromoToggle } from "./promo-form";

export const instant = false;
export const metadata = { title: "Promo codes · Admin", ...NO_INDEX };

function state(p: PromoCode, used: number, now: number): { label: string; tone: Tone } {
  if (!p.active) return { label: "Off", tone: "board" };
  if (p.expires_at && new Date(p.expires_at).getTime() <= now) return { label: "Ended", tone: "board" };
  if (p.starts_at && new Date(p.starts_at).getTime() > now) return { label: "Scheduled", tone: "sky" };
  if (p.max_redemptions != null && used >= p.max_redemptions) return { label: "Used up", tone: "butter" };
  return { label: "Live", tone: "mint" };
}

function rules(p: PromoCode): string {
  const list = [
    p.min_days > 1 ? `${pluralize(p.min_days, "day")} or longer` : null,
    p.first_trip_only ? "first trip only" : null,
    `${pluralize(p.per_user_limit, "use")} per person`,
    p.starts_at ? `from ${formatDate(p.starts_at)}` : null,
    // expires_at is midnight after the last day, so step back a minute to show that day.
    p.expires_at ? `until ${formatDate(new Date(new Date(p.expires_at).getTime() - 60_000))}` : null,
  ];
  return list.filter(Boolean).join(" · ");
}

/** Every code, how many live trips used each, and the moment it was read. */
async function loadPromos() {
  const admin = createAdminClient();

  const [{ data: codes }, { data: redeemed }] = await Promise.all([
    admin.from("promo_codes").select("*").order("created_at", { ascending: false }),
    admin.from("trips").select("promo_code").not("promo_code", "is", null).not("status", "in", '("cancelled_guest","cancelled_host")'),
  ]);
  const uses = new Map<string, number>();
  for (const t of redeemed ?? []) {
    if (t.promo_code) uses.set(t.promo_code, (uses.get(t.promo_code) ?? 0) + 1);
  }
  return { codes: codes ?? [], uses, now: Date.now() };
}

export default async function AdminPromosPage() {
  await requireAdminPage("/host/admin/promos");
  const { codes, uses, now } = await loadPromos();

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-4">
      <PageTitle title="Promo codes" lead="Codes guests can use at checkout. Uses count trips that weren't cancelled." action={<NewPromoButton />} />

      {!codes.length && <EmptyState icon={<TicketPercent />} title="No codes yet." body="Make one for a newsletter, a partner or a first-trip offer." />}

      {!!codes.length && (
        <Tile className="flex flex-col gap-1 p-2 sm:p-2">
          {codes.map((p) => {
            const used = uses.get(p.code) ?? 0;
            const s = state(p, used, now);
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] px-3.5 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[17px] font-extrabold">{p.code}</span>
                    <Tag tone="lilac">{p.percent_off != null ? `${p.percent_off}% off` : `${formatCurrency(p.amount_off_cents ?? 0)} off`}</Tag>
                    <Tag tone={s.tone}>{s.label}</Tag>
                  </div>
                  <span className="text-[14px] text-slate">
                    {p.description ? `${p.description} · ` : ""}
                    {rules(p)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="figures text-[15px] font-bold">
                    {used}
                    {p.max_redemptions != null ? ` / ${p.max_redemptions}` : ""} used
                  </span>
                  <PromoToggle promoId={p.id} code={p.code} active={p.active} />
                </div>
              </div>
            );
          })}
        </Tile>
      )}
    </div>
  );
}
