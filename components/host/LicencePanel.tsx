import { Tag, Tile, TileTitle } from "@/components/kit";
import { LicenceReview } from "@/components/host/LicenceReview";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadLicencePhotos } from "@/lib/guest-checks";
import { formatDate } from "@/lib/utils";

/**
 * The guest's licence photos on a booked trip. Only render this for the
 * trip's host or Cascade: it hands out links to the photos.
 */
export async function LicencePanel({ tripId, guestId, status }: { tripId: string; guestId: string; status: string }) {
  if (status !== "approved" && status !== "active") return null;
  const [photos, { data: guest }] = await Promise.all([
    loadLicencePhotos(guestId),
    createAdminClient().from("profiles").select("full_name, date_of_birth, identity_status").eq("id", guestId).maybeSingle(),
  ]);
  if (!photos || !guest) return null;
  const waiting = guest.identity_status === "pending";
  // A rejected licence waits for new photos, so there's nothing to look at.
  if (guest.identity_status === "failed") return null;

  return (
    <Tile id="licence" className="flex scroll-mt-4 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TileTitle className="text-[22px]">Driver&apos;s licence</TileTitle>
        <Tag tone={waiting ? "butter" : "mint"}>{waiting ? "Waiting for you" : "Approved"}</Tag>
      </div>
      {waiting && <p className="text-[15px] text-slate">Compare the photos with the booking. The guest can&apos;t check in until you approve.</p>}
      <LicenceReview
        tripId={tripId}
        name={guest.full_name}
        birthday={guest.date_of_birth ? formatDate(`${guest.date_of_birth}T12:00:00Z`, { month: "long" }) : null}
        licenceUrl={photos.licenceUrl}
        selfieUrl={photos.selfieUrl}
        waiting={waiting}
      />
    </Tile>
  );
}
