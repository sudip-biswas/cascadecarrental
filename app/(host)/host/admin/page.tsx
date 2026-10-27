import Link from "next/link";
import { BadgeCheck, CalendarClock, Gavel, Receipt, Shield, TicketPercent, Users, type LucideIcon } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { NO_INDEX } from "@/lib/site";
import { PageTitle, Tile, type Tone } from "@/components/kit";
import { requireAdminPage, todayBounds } from "./_lib/admin";

export const instant = false;
export const metadata = { title: "Admin", ...NO_INDEX };

function Stat({ href, label, count, icon: Icon, tone }: { href: string; label: string; count: number; icon: LucideIcon; tone: Tone }) {
  return (
    <Link href={href} className="flex-[1_1_220px] transition-transform active:scale-[0.99]">
      <Tile tone={count > 0 ? tone : "white"} className="flex h-full flex-col gap-3">
        <Icon className="size-6" strokeWidth={1.75} />
        <span className="figures font-display text-[44px] leading-none font-extrabold">{count}</span>
        <span className="text-[15px] font-bold">{label}</span>
      </Tile>
    </Link>
  );
}

export default async function AdminPage() {
  await requireAdminPage("/host/admin");
  const admin = createAdminClient();

  const day = todayBounds();
  const now = new Date().toISOString();
  const count = { count: "exact", head: true } as const;

  const [disputes, awaiting, pickups, returns, verifications, promos] = await Promise.all([
    admin.from("trip_charges").select("id", count).eq("status", "disputed"),
    admin.from("trip_charges").select("id", count).eq("status", "requested"),
    admin
      .from("trips")
      .select("id", count)
      .in("status", ["approved", "active"])
      .gte("starts_at", day.start)
      .lt("starts_at", day.end),
    admin
      .from("trips")
      .select("id", count)
      .in("status", ["approved", "active"])
      .gte("ends_at", day.start)
      .lt("ends_at", day.end),
    admin.from("profiles").select("id", count).eq("identity_status", "pending"),
    admin.from("promo_codes").select("id", count).eq("active", true).or(`expires_at.is.null,expires_at.gt.${now}`),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <PageTitle title="Admin" lead="What needs a look today, and the tools to sort it." />

      <div className="flex flex-wrap gap-4">
        <Stat href="/host/admin/disputes" label="Open disputes" count={disputes.count ?? 0} icon={Gavel} tone="peach" />
        <Stat href="/host/admin/disputes?status=requested" label="Charges awaiting payment" count={awaiting.count ?? 0} icon={Receipt} tone="butter" />
        <Stat
          href="/host/admin/trips?q=today"
          label="Pick-ups and returns today"
          count={(pickups.count ?? 0) + (returns.count ?? 0)}
          icon={CalendarClock}
          tone="sky"
        />
        <Stat href="/host/admin/users?q=pending" label="Pending verifications" count={verifications.count ?? 0} icon={BadgeCheck} tone="lilac" />
        <Stat href="/host/admin/promos" label="Active promo codes" count={promos.count ?? 0} icon={TicketPercent} tone="mint" />
      </div>

      <Tile className="flex flex-wrap gap-2">
        {[
          { href: "/host/admin/disputes", label: "Disputes", icon: Gavel },
          { href: "/host/admin/trips", label: "Every trip", icon: CalendarClock },
          { href: "/host/admin/users", label: "Users", icon: Users },
          { href: "/host/admin/promos", label: "Promo codes", icon: TicketPercent },
          { href: "/host/admin/personas", label: "Personas", icon: Shield },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-[14px] bg-board px-4 py-3 text-[15px] font-bold hover:bg-line"
          >
            <Icon className="size-[18px]" strokeWidth={1.75} />
            {label}
          </Link>
        ))}
      </Tile>
    </div>
  );
}
