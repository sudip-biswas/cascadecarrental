import { Star } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { Tag, Tile, TileTitle } from "@/components/kit";
import { firstName } from "@/components/host/bits";
import { ReplyForm } from "@/app/(host)/host/business/ratings/ReplyForm";
import { formatDate } from "@/lib/utils";
import { ISSUE_TAGS } from "@/components/reviews/categories";
import type { Review } from "@/lib/supabase/types";
import { HostReviewForm } from "./review/HostReviewForm";
import { GUEST_RATING_LABELS, HOST_RATING_LABELS, hostReviewCloses } from "./review/window";

type ReviewRow = Pick<
  Review,
  | "id"
  | "kind"
  | "rating_overall"
  | "rating_cleanliness"
  | "rating_maintenance"
  | "rating_communication"
  | "rating_convenience"
  | "rating_accuracy"
  | "rating_value"
  | "issue_tags"
  | "body"
  | "host_reply"
  | "created_at"
>;

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={i < value ? "size-4 fill-ink" : "size-4 fill-ink/15"} strokeWidth={0} />
      ))}
    </span>
  );
}

/** Stars, the extra ratings that were given, and the note. */
function ReviewBody({ review }: { review: ReviewRow }) {
  const labels = review.kind === "host_to_guest" ? HOST_RATING_LABELS : GUEST_RATING_LABELS;
  const extras = (Object.keys(labels) as (keyof typeof labels)[]).flatMap((key) => {
    const value = (review as Record<string, unknown>)[key];
    return typeof value === "number" ? [[labels[key] as string, value] as const] : [];
  });
  const tags = (review.issue_tags ?? []).flatMap((id) => ISSUE_TAGS.get(id)?.label ?? []);
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Stars value={review.rating_overall} />
        <span className="text-sm text-slate">{formatDate(review.created_at)}</span>
      </div>
      {extras.length > 0 && (
        <p className="text-sm text-slate">{extras.map(([label, value]) => `${label} ${value}/5`).join(" · ")}</p>
      )}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Tag key={t} tone="white" className="px-2.5 py-1.5">
              {t}
            </Tag>
          ))}
        </div>
      )}
      {review.body && <p className="text-base leading-normal">&ldquo;{review.body}&rdquo;</p>}
    </>
  );
}

/**
 * Two-way reviews on a finished trip. Hosts review the guest within 14 days
 * and see what the guest wrote about the trip, with their reply. The guest's
 * own review form lives on their trip page.
 */
export async function ReviewPanel({ tripId, viewer, userId }: { tripId: string; viewer: "guest" | "host"; userId: string }) {
  if (viewer !== "host") return null;

  const admin = createAdminClient();
  const [{ data: trip }, { data: reviews }] = await Promise.all([
    admin
      .from("trips")
      .select("id, host_id, status, ends_at, completed_at, guest:profiles!guest_id(full_name)")
      .eq("id", tripId)
      .maybeSingle(),
    admin
      .from("reviews")
      .select(
        "id, kind, rating_overall, rating_cleanliness, rating_maintenance, rating_communication, rating_convenience, rating_accuracy, rating_value, issue_tags, body, host_reply, created_at"
      )
      .eq("trip_id", tripId)
      .overrideTypes<ReviewRow[], { merge: false }>(),
  ]);
  if (!trip || trip.host_id !== userId || trip.status !== "completed") return null;

  const guest = firstName((trip.guest as { full_name: string } | null)?.full_name);
  const mine = reviews?.find((r) => r.kind === "host_to_guest");
  const theirs = reviews?.find((r) => r.kind === "guest_to_host");
  const closes = hostReviewCloses(trip);
  const open = closes > new Date();

  return (
    <Tile tone={!mine && open ? "butter" : "white"} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        <TileTitle>{mine ? `Your review of ${guest}` : `How was ${guest}?`}</TileTitle>
        {mine ? (
          <div className="flex flex-col gap-2 rounded-[18px] bg-board p-4">
            <ReviewBody review={mine} />
          </div>
        ) : open ? (
          <>
            <p className="text-[15px]">
              Other hosts see this on {guest}&apos;s requests. You have until {formatDate(closes, { year: undefined })}.
            </p>
            <HostReviewForm tripId={tripId} guestName={guest} />
          </>
        ) : (
          <p className="text-[15px] text-slate">Reviews for this trip closed on {formatDate(closes)}.</p>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <h3 className="text-lg font-extrabold">{guest}&apos;s review of the trip</h3>
        {theirs ? (
          <div className="flex flex-col gap-2 rounded-[18px] bg-board p-4">
            <ReviewBody review={theirs} />
            {theirs.host_reply ? (
              <div className="rounded-2xl bg-white px-3.5 py-3 text-[15px]">
                <span className="font-extrabold">You replied:</span> {theirs.host_reply}
              </div>
            ) : (
              <ReplyForm reviewId={theirs.id} guestName={guest} />
            )}
          </div>
        ) : (
          <p className="text-[15px] text-slate">{guest} hasn&apos;t reviewed it yet.</p>
        )}
      </div>
    </Tile>
  );
}
