"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarX, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Tile, TileTitle } from "@/components/kit";
import { Toggle } from "@/components/listing-wizard/controls";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { TIME_STEPS, WEEKDAYS, formatClock, type DayHours, type HostHours } from "@/lib/trip-rules";

const select =
  "h-[38px] cursor-pointer rounded-[10px] bg-board px-2.5 text-[15px] font-bold outline-none hover:bg-line focus-visible:ring-2 focus-visible:ring-ink disabled:cursor-default disabled:opacity-40";

/** The square switch from the listing boards, small enough to sit in a row. */
function DaySwitch({ checked, onChange, day }: { checked: boolean; onChange: (open: boolean) => void; day: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`Available on ${day}`}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 rounded-[10px] py-1 pr-1 text-[13px] font-extrabold"
    >
      <span
        aria-hidden
        className={cn(
          "relative inline-block h-[26px] w-11 shrink-0 rounded-[9px] transition-colors",
          checked ? "bg-ink" : "bg-[#e3e5ea]"
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] size-5 rounded-[7px] bg-white transition-[left]",
            checked ? "left-[21px]" : "left-[3px]"
          )}
        />
      </span>
      <span className={cn("w-[62px] text-left", checked ? "text-mint-ink" : "text-slate")}>
        {checked ? "Available" : "Closed"}
      </span>
    </button>
  );
}

function DayRow({ name, day, onChange }: { name: string; day: DayHours; onChange: (day: DayHours) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[18px] bg-white px-3.5 py-3">
      <span className="flex min-w-[220px] items-center gap-3">
        <span className="w-[104px] text-base font-semibold">{name}</span>
        <DaySwitch day={name} checked={day.open} onChange={(open) => onChange({ ...day, open })} />
      </span>
      <span className="flex items-center gap-2">
        <select
          aria-label={`${name} from`}
          value={day.from}
          disabled={!day.open}
          className={select}
          onChange={(e) => {
            const from = e.target.value;
            // Keep the window at least half an hour long.
            const to = day.to > from ? day.to : (TIME_STEPS[TIME_STEPS.indexOf(from) + 1] ?? "23:30");
            onChange({ ...day, from, to });
          }}
        >
          {TIME_STEPS.slice(0, -1).map((t) => (
            <option key={t} value={t}>
              {formatClock(t)}
            </option>
          ))}
        </select>
        <span className="text-slate">–</span>
        <select
          aria-label={`${name} until`}
          value={day.to}
          disabled={!day.open}
          className={select}
          onChange={(e) => onChange({ ...day, to: e.target.value })}
        >
          {TIME_STEPS.filter((t) => t > day.from).map((t) => (
            <option key={t} value={t}>
              {formatClock(t)}
            </option>
          ))}
        </select>
      </span>
    </div>
  );
}

/** The host's pickup and return hours, for every car they list. Saves on change. */
export function HoursEditor({ hostId, initial }: { hostId: string; initial: HostHours }) {
  const router = useRouter();
  const [hours, setHours] = useState(initial);

  async function change(next: HostHours) {
    const before = hours;
    setHours(next);
    const { error } = await createClient()
      .from("host_hours")
      .upsert({
        host_id: hostId,
        always_available: next.alwaysAvailable,
        week: next.week as unknown as Json,
        updated_at: new Date().toISOString(),
      });
    if (error) {
      toast.error("Not saved. Try again.");
      setHours(before);
      return;
    }
    router.refresh();
  }

  const openDays = hours.week.filter((d) => d.open).length;

  return (
    <Tile tone="mint" className="flex flex-col gap-3 text-ink sm:p-6">
      <div className="mb-1 flex flex-col gap-1">
        <TileTitle>Pickup and return hours</TileTitle>
        <p className="max-w-[640px] text-[15px] text-mint-ink">
          Guests can only book trips that start and end when you&apos;re available. These hours apply to all your cars.
        </p>
      </div>

      <Toggle
        label="Always available"
        hint={hours.alwaysAvailable ? "Guests can pick up and return at any time" : "Guests pick times inside the hours below"}
        checked={hours.alwaysAvailable}
        onChange={(alwaysAvailable) => change({ ...hours, alwaysAvailable })}
      />

      {!hours.alwaysAvailable && (
        <>
          <div className="flex flex-col gap-2">
            {hours.week.map((day, i) => (
              <DayRow
                key={WEEKDAYS[i]}
                name={WEEKDAYS[i]}
                day={day}
                onChange={(next) => change({ ...hours, week: hours.week.map((d, j) => (j === i ? next : d)) })}
              />
            ))}
          </div>
          {openDays === 0 && (
            <p role="alert" className="px-1 text-sm font-semibold text-error">
              Every day is closed, so nobody can book your cars. Open at least one day.
            </p>
          )}
        </>
      )}

      <Link
        href="/host/calendar"
        className="flex items-center gap-3 rounded-[18px] bg-white px-3.5 py-3 transition-colors hover:bg-board"
      >
        <CalendarX className="size-5 shrink-0" strokeWidth={2} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-base font-semibold">Block dates</span>
          <span className="text-[13px] text-slate">Away for a few days? Block them on the calendar so nobody books.</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-slate" strokeWidth={2} />
      </Link>
    </Tile>
  );
}
