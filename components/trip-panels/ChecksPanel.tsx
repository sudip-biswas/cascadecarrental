import { Check, IdCard, ShieldCheck } from "lucide-react";
import { Tag, Tile, TileTitle } from "@/components/kit";
import { LicenceCheck } from "@/components/profile/LicenceCheck";
import { InsuranceForm } from "@/components/profile/InsuranceForm";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCancelled } from "@/lib/trips";
import { type Cover, guestChecks, loadOwnInsurance } from "@/lib/guest-checks";
import { cn, formatDate, formatDateTime, zonedInstant } from "@/lib/utils";

/** Date keys are Seattle days; read as instants they would land a day early. */
const day = (key: string) => formatDate(zonedInstant(key));

function coverLine(cover: Cover): string {
  switch (cover.kind) {
    case "plan":
      return `Covered by the ${cover.plan} protection plan you picked.`;
    case "insurance":
      return `Your ${cover.insurer} policy, through ${day(cover.expiresOn)}.`;
    case "expired":
      return `Your ${cover.insurer} policy ends ${day(cover.expiresOn)}, before pick-up. Add the new one.`;
    case "declined":
      return "You said you don't have insurance, and this trip has no protection plan. Add a policy, or cancel and book again with protection.";
    case "missing":
      return "This trip has no protection plan, so add your own car insurance. It's saved for next time.";
  }
}

function Item({
  icon,
  title,
  done,
  onColour,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  done: boolean;
  /** The tile is coloured, so the item sits on white. */
  onColour: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className={cn("flex items-start gap-3.5 rounded-[20px] p-3.5 text-ink sm:p-4", onColour ? "bg-white" : "bg-board")}>
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-[14px]",
          done ? "bg-mint text-mint-ink" : onColour ? "bg-board" : "bg-white"
        )}
      >
        {done ? <Check className="size-5" strokeWidth={2.5} /> : icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-[17px] font-extrabold">{title}</span>
        {children}
      </span>
    </li>
  );
}

/**
 * "Before you pick up": the licence check and cover for the car, due by
 * pick-up. The guest can't check in until both are done.
 */
export async function ChecksPanel({ tripId, userId, returned = false }: { tripId: string; userId: string; returned?: boolean }) {
  const admin = createAdminClient();
  const { data: trip } = await admin
    .from("trips")
    .select("guest_id, status, starts_at, protection_plan")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip || trip.guest_id !== userId) return null;
  if (trip.status === "completed" || isCancelled(trip.status)) return null;

  const [{ data: profile }, insurance] = await Promise.all([
    admin.from("profiles").select("driving_license_verified, identity_status, identity_error").eq("id", userId).maybeSingle(),
    loadOwnInsurance(userId),
  ]);
  const checks = guestChecks(trip, profile, insurance);
  const started = new Date() >= new Date(trip.starts_at);
  // Once the trip is under way there's nothing to nag about if it's all done.
  if (started && !checks.missing.length) return null;

  const left = checks.missing.length;
  const licenceDone = checks.licence === "verified";
  const coverDone = !checks.missing.includes("cover");

  return (
    <Tile id="checks" tone={left ? "butter" : undefined} className="flex scroll-mt-4 flex-col gap-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
        <div className="flex flex-col gap-1">
          <TileTitle>{left ? "Before you pick up" : "You're approved to drive"}</TileTitle>
          <p className={cn("text-[15px]", left ? "text-butter-ink" : "text-slate")}>
            {left
              ? `Due by pick-up, ${formatDateTime(trip.starts_at)}. Check-in stays locked until it's done.`
              : "Your licence is checked and the car is covered."}
          </p>
        </div>
        <Tag tone="white">{left ? `${2 - left} of 2 done` : "2 of 2 done"}</Tag>
      </div>

      <ul className="flex flex-col gap-2">
        <Item icon={<IdCard className="size-5" strokeWidth={1.75} />} title="Driver's licence and selfie" done={licenceDone} onColour={left > 0}>
          <LicenceCheck
            status={checks.licence}
            error={checks.licenceError}
            returned={returned}
            returnTo={`/trips/${tripId}`}
            leadClassName="text-slate"
          />
        </Item>
        <Item
          icon={<ShieldCheck className="size-5" strokeWidth={1.75} />}
          title={checks.cover.kind === "plan" ? "Protection plan" : "Car insurance"}
          done={coverDone}
          onColour={left > 0}
        >
          <span className="text-[15px] text-slate">{coverLine(checks.cover)}</span>
          {checks.cover.kind !== "plan" && (
            <InsuranceForm insurance={insurance} variant={coverDone ? "secondary" : "default"} />
          )}
        </Item>
      </ul>
    </Tile>
  );
}
