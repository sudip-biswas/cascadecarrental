import Link from "next/link";
import { MessageSquare, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate, pluralize } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface HostCardProps {
  hostId: string;
  /** First name, as the rest of the page says it. */
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  hostSince: string | null;
  profileHref: string | null;
  /** Hosts who list under a persona show the persona's own numbers. */
  persona: { tripCount: number; rating: number | null; ratingCount: number } | null;
  /** Shows "Ask {name}"; left out for the owner. */
  messageHref: string | null;
  /** How many cars the host has listed. */
  cars: number | null;
}

/** Whole years since a date. */
function yearsSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / (365.25 * 86_400_000));
}

/** Trips and rating across everything the host lists. */
async function hostStats(hostId: string) {
  const supabase = await createClient();
  const [{ data: cars }, { data: reviews }] = await Promise.all([
    supabase.from("vehicles").select("trip_count").eq("host_id", hostId).eq("status", "listed"),
    supabase.from("reviews").select("rating_overall").eq("reviewee_id", hostId).eq("kind", "guest_to_host"),
  ]);
  const ratings = (reviews ?? []).map((r) => r.rating_overall);
  return {
    tripCount: (cars ?? []).reduce((sum, c) => sum + c.trip_count, 0),
    rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    ratingCount: ratings.length,
  };
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- avatars come from anywhere, and are tiny
    <img src={url} alt={name} className="size-16 rounded-[18px] object-cover sm:size-20 sm:rounded-[22px]" />
  ) : (
    <span
      aria-hidden
      className="flex size-16 items-center justify-center rounded-[18px] bg-mint font-display text-[26px] font-extrabold sm:size-20 sm:rounded-[22px]"
    >
      {name[0]?.toUpperCase()}
    </span>
  );
}

/** "Hosted by Morgan": rating, trips, years hosting and cars, with a way to ask a question. */
export async function HostCard({ hostId, name, avatarUrl, bio, hostSince, profileHref, persona, messageHref, cars }: HostCardProps) {
  const stats = await hostStats(hostId);
  const tripCount = persona ? persona.tripCount : stats.tripCount;
  const rating = persona ? persona.rating : stats.rating;
  const ratingCount = persona ? persona.ratingCount : stats.ratingCount;
  const years = hostSince ? yearsSince(hostSince) : null;

  const facts = [
    ratingCount > 0 ? pluralize(ratingCount, "rating") : null,
    tripCount > 0 ? pluralize(tripCount, "trip") : null,
    hostSince
      ? years && years >= 1
        ? `${pluralize(years, "year")} hosting`
        : `Hosting since ${formatDate(hostSince, { day: undefined, month: "long" })}`
      : null,
    cars ? pluralize(cars, "car") : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-wrap items-start gap-4 rounded-[24px] bg-white p-4 sm:p-[18px]">
      <span className="relative shrink-0 pb-2">
        {profileHref ? (
          <Link href={profileHref} className="block transition-opacity hover:opacity-80">
            <Avatar name={name} url={avatarUrl} />
          </Link>
        ) : (
          <Avatar name={name} url={avatarUrl} />
        )}
        {rating != null && (
          <span className="figures absolute -bottom-0.5 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full bg-white px-2 py-0.5 text-[13px] font-extrabold shadow-sm">
            {rating.toFixed(1)}
            <Star className="size-3 fill-ink" strokeWidth={0} />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
        {profileHref ? (
          <Link href={profileHref} className="font-display text-[22px] font-extrabold hover:underline sm:text-[24px]">
            Hosted by {name}
          </Link>
        ) : (
          <span className="font-display text-[22px] font-extrabold sm:text-[24px]">Hosted by {name}</span>
        )}
        {facts.length > 0 && <span className="text-[14px] text-slate">{facts.join(" · ")}</span>}
        {bio && <p className="mt-1 text-[15px] text-slate">{bio}</p>}
      </span>
      {messageHref && (
        <Button asChild variant="secondary" className="mt-auto">
          <Link href={messageHref}>
            <MessageSquare strokeWidth={1.75} />
            Ask {name}
          </Link>
        </Button>
      )}
    </div>
  );
}
