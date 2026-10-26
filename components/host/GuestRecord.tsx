import { cache } from "react";
import { Star } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Fact, Tile, TileTitle, type Tone } from "@/components/kit";
import { cn, formatDate, pluralize } from "@/lib/utils";

export interface GuestRecordData {
  tripsCompleted: number;
  /** Average of what hosts gave them, null before their first host review. */
  rating: number | null;
  ratingCount: number;
  memberSince: string;
  licenceChecked: boolean;
}

/**
 * A guest's history on Cascade: finished trips, what hosts rated them, and
 * their checks. Reads across trips with the admin client, so only call it for
 * a guest the viewer has a trip or request with (or for yourself).
 */
export const loadGuestRecord = cache(async (guestId: string): Promise<GuestRecordData | null> => {
  const admin = createAdminClient();
  const [{ data: profile }, { count: trips }, { data: reviews }] = await Promise.all([
    admin.from("profiles").select("created_at, driving_license_verified").eq("id", guestId).maybeSingle(),
    admin
      .from("trips")
      .select("id", { count: "exact", head: true })
      .eq("guest_id", guestId)
      .eq("status", "completed"),
    admin.from("reviews").select("rating_overall").eq("reviewee_id", guestId).eq("kind", "host_to_guest"),
  ]);
  if (!profile) return null;

  const ratings = (reviews ?? []).map((r) => r.rating_overall);
  return {
    tripsCompleted: trips ?? 0,
    rating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    ratingCount: ratings.length,
    memberSince: profile.created_at,
    licenceChecked: profile.driving_license_verified,
  };
});

function ratingText(record: GuestRecordData) {
  return record.rating == null ? "No reviews yet" : `${record.rating.toFixed(1)} (${record.ratingCount})`;
}

/**
 * The guest's track record. `line` is one quiet sentence for tight cards,
 * `grid` four facts, `tile` the grid on its own tile with a heading.
 */
export async function GuestRecord({
  guestId,
  name = "Guest",
  variant = "grid",
  tone = "board",
  className,
}: {
  guestId: string;
  name?: string;
  variant?: "line" | "grid" | "tile";
  tone?: Tone;
  className?: string;
}) {
  const record = await loadGuestRecord(guestId);
  if (!record) return null;

  if (variant === "line") {
    return (
      <p className={cn("flex flex-wrap items-center gap-x-1.5 text-sm text-slate", className)}>
        <span>{record.tripsCompleted ? pluralize(record.tripsCompleted, "trip") : "First trip"}</span>
        {record.rating != null && (
          <>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-current" strokeWidth={1.75} aria-label="Rated" />
              {record.rating.toFixed(1)} from hosts
            </span>
          </>
        )}
        <span aria-hidden>·</span>
        <span>{record.licenceChecked ? "licence checked" : "licence not checked"}</span>
      </p>
    );
  }

  const grid = (
    <div className={cn("figures grid grid-cols-2 gap-2", variant === "grid" && className)}>
      <Fact label="Trips done" value={record.tripsCompleted} tone={tone} />
      <Fact
        label="From hosts"
        value={
          record.rating == null ? (
            ratingText(record)
          ) : (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 fill-current" strokeWidth={1.75} aria-hidden />
              {ratingText(record)}
            </span>
          )
        }
        tone={tone}
      />
      <Fact label="Member since" value={formatDate(record.memberSince, { day: undefined })} tone={tone} />
      <Fact label="Licence" value={record.licenceChecked ? "Checked" : "Not checked"} tone={tone} />
    </div>
  );

  if (variant === "grid") return grid;

  return (
    <Tile className={cn("flex flex-col gap-2.5", className)}>
      <TileTitle className="text-[22px]">{name}&apos;s record</TileTitle>
      {grid}
    </Tile>
  );
}
