import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadTripCheckin } from "@/lib/guest-checks";
import { Tag, Tile, TileTitle } from "@/components/kit";
import { formatDateTime } from "@/lib/utils";
import { CheckinReviewForm } from "./CheckinReviewForm";

/**
 * Host-only panel showing the guest's licence photo and selfie, with
 * approve / reject controls. Returns null if the viewer isn't the host or
 * if no submission has been made yet.
 */
export async function CheckinPanel({ tripId, userId }: { tripId: string; userId: string }) {
  const admin = createAdminClient();
  const { data: trip } = await admin
    .from("trips")
    .select("host_id, guest:profiles!guest_id(full_name)")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip || trip.host_id !== userId) return null;

  const checkin = await loadTripCheckin(tripId);
  if (!checkin) return null;

  const guest = (trip.guest as unknown as { full_name: string } | null)?.full_name ?? "Guest";
  const submitted = formatDateTime(checkin.submitted_at);

  return (
    <Tile className="flex flex-col gap-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <TileTitle>Check-in review</TileTitle>
          <p className="text-[15px] text-slate">
            {guest} submitted their licence photo and selfie {submitted}.
          </p>
        </div>
        <Tag
          tone={
            checkin.status === "approved" ? "mint" : checkin.status === "rejected" ? "peach" : "butter"
          }
        >
          {checkin.status === "approved" ? "Approved" : checkin.status === "rejected" ? "Rejected" : "Pending review"}
        </Tag>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Photo src={checkin.licenseUrl} label="Licence" />
        <Photo src={checkin.selfieUrl} label="Selfie" />
      </div>

      {checkin.status === "rejected" && checkin.host_notes && (
        <p className="rounded-[14px] bg-board px-3 py-2.5 text-[15px] text-slate">
          <span className="font-semibold text-ink">Your note: </span>
          {checkin.host_notes}
        </p>
      )}

      <CheckinReviewForm tripId={tripId} currentStatus={checkin.status} />
    </Tile>
  );
}

function Photo({ src, label }: { src: string | null; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-slate">{label}</span>
      {src ? (
        <div className="relative aspect-[4/3] overflow-hidden rounded-[14px] bg-board">
          <Image src={src} alt={label} fill className="object-cover" sizes="(max-width: 640px) 45vw, 280px" unoptimized />
        </div>
      ) : (
        <div className="flex aspect-[4/3] items-center justify-center rounded-[14px] bg-board text-sm text-slate">
          Photo unavailable
        </div>
      )}
    </div>
  );
}
