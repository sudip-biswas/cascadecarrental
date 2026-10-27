import { cache } from "react";
import { ChevronDown, KeyRound } from "lucide-react";
import { Tile, TileTitle } from "@/components/kit";
import { Initial, firstName } from "@/components/host/bits";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CHECK_IN, hasContent, isBooked, welcomeOpen } from "@/lib/guest-instructions";

/**
 * The trip and the car's instructions, for the guest on it. Read through the
 * guest's own session, so the database only hands them over once the trip is
 * booked. Cached so the welcome note and the panel share one read.
 */
const loadForGuest = cache(async (tripId: string, userId: string) => {
  const { data: trip } = await createAdminClient()
    .from("trips")
    .select("id, guest_id, vehicle_id, status, starts_at, delivery_address, host:profiles!host_id(id, full_name)")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip || trip.guest_id !== userId || !isBooked(trip.status)) return null;

  const supabase = await createClient();
  const { data: instructions } = await supabase
    .from("vehicle_guest_instructions")
    .select("*")
    .eq("vehicle_id", trip.vehicle_id)
    .maybeSingle();
  if (!instructions) return null;
  const host = trip.host as unknown as { id: string; full_name: string } | null;
  return { trip, host, instructions };
});

/** The host's welcome note, near the top of the guest's trip around check-in. */
export async function InstructionsWelcome({ tripId, viewer, userId }: { tripId: string; viewer: "guest" | "host"; userId: string }) {
  if (viewer !== "guest") return null;
  const loaded = await loadForGuest(tripId, userId);
  const message = loaded?.instructions.welcome_message?.trim();
  if (!loaded || !message || !welcomeOpen(loaded.trip)) return null;
  const host = firstName(loaded.host?.full_name, "Your host");

  return (
    <Tile tone="lilac" className="flex items-start gap-3.5 sm:p-6">
      <Initial name={host} seed={loaded.host?.id} tone="white" className="size-11 rounded-[14px] text-[18px]" />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-sm font-semibold">A note from {host}</span>
        <p className="font-display text-[clamp(19px,2.2vw,22px)] leading-snug font-extrabold tracking-[-0.01em] text-ink">
          {message}
        </p>
      </div>
    </Tile>
  );
}

/** How to get the car, the host's guide to it, and their FAQs. Booked trips only. */
export async function InstructionsPanel({ tripId, viewer, userId }: { tripId: string; viewer: "guest" | "host"; userId: string }) {
  if (viewer !== "guest") return null;
  const loaded = await loadForGuest(tripId, userId);
  if (!loaded) return null;
  const { trip, instructions: ins } = loaded;
  const host = firstName(loaded.host?.full_name, "your host");
  const delivered = !!trip.delivery_address;
  const pickup = ins.pickup_instructions?.trim();
  const guide = ins.car_guide?.trim();
  if (!hasContent(ins) && delivered) return null;

  return (
    <Tile className="flex flex-col gap-4 sm:p-6">
      <TileTitle>Your car</TileTitle>

      <div className="flex flex-col gap-3 rounded-[20px] bg-board p-4">
        <span className="flex items-center gap-2.5 text-[17px] font-extrabold">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-white">
            <KeyRound className="size-[18px]" strokeWidth={1.75} />
          </span>
          {delivered ? `${host} brings the car to you.` : CHECK_IN[ins.check_in_method].guestLine}
        </span>
        {delivered ? (
          <p className="text-[15px] text-slate">Message {host} to set up the handoff.</p>
        ) : pickup ? (
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-slate">Pick-up and return</span>
            <p className="text-[15px] leading-[1.5] whitespace-pre-line">{pickup}</p>
          </div>
        ) : null}
      </div>

      {guide && (
        <Section title="Car guide" open={trip.status !== "completed"}>
          <p className="text-[15px] leading-[1.5] whitespace-pre-line">{guide}</p>
        </Section>
      )}

      {ins.faqs.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="px-1 text-lg font-extrabold">Questions</h3>
          {ins.faqs.map((f, i) => (
            <Section key={i} title={f.question} small>
              <p className="text-[15px] leading-[1.5] whitespace-pre-line text-slate">{f.answer}</p>
            </Section>
          ))}
        </div>
      )}
    </Tile>
  );
}

function Section({ title, open, small, children }: { title: string; open?: boolean; small?: boolean; children: React.ReactNode }) {
  return (
    <details open={open} className="group rounded-[18px] bg-board">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className={small ? "text-[15px] font-bold" : "text-lg font-extrabold"}>{title}</span>
        <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}
