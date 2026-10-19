import { notFound } from "next/navigation";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { NO_INDEX } from "@/lib/site";
import { formatDate, pluralize } from "@/lib/utils";
import { LISTED_VEHICLE_SELECT, type ListedVehicle } from "@/components/search/vehicle";
import { VehicleCard } from "@/components/search/VehicleCard";

export const instant = false;
export const metadata = { ...NO_INDEX };

type Persona = {
  id: string;
  name: string;
  avatar_url: string | null;
  host_since: string | null;
  bio: string | null;
  trip_count: number;
  rating: number | null;
  rating_count: number;
};

export default async function HostProfilePage({ params }: PageProps<"/hosts/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: persona } = await supabase
    .from("host_personas")
    .select("id, name, avatar_url, host_since, bio, trip_count, rating, rating_count")
    .eq("id", id)
    .single();

  if (!persona) notFound();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select(LISTED_VEHICLE_SELECT)
    .eq("persona_id", id)
    .eq("status", "listed")
    .order("trip_count", { ascending: false });

  const listed = (vehicles ?? []) as unknown as ListedVehicle[];

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      {/* Profile header */}
      <div className="flex flex-wrap items-start gap-6">
        {persona.avatar_url ? (
          <img
            src={persona.avatar_url}
            alt={persona.name}
            className="size-24 shrink-0 rounded-[24px] object-cover sm:size-32 sm:rounded-[28px]"
          />
        ) : (
          <span className="flex size-24 shrink-0 items-center justify-center rounded-[24px] bg-mint font-display text-[40px] font-extrabold sm:size-32 sm:rounded-[28px]">
            {persona.name[0]?.toUpperCase()}
          </span>
        )}
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[32px] font-extrabold leading-tight tracking-[-0.025em] sm:text-[40px]">
            {persona.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-slate">
            {persona.rating != null && (
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <Star className="size-4 fill-ink" strokeWidth={0} />
                {persona.rating.toFixed(1)}
                {persona.rating_count > 0 && (
                  <span className="font-normal text-slate">({persona.rating_count} ratings)</span>
                )}
              </span>
            )}
            {persona.trip_count > 0 && <span>{pluralize(persona.trip_count, "trip")}</span>}
            {persona.host_since && (
              <span>Hosting since {formatDate(persona.host_since, { day: undefined, month: "long" })}</span>
            )}
            {listed.length > 0 && <span>{pluralize(listed.length, "car")} listed</span>}
          </div>
          {persona.bio && (
            <p className="mt-1 max-w-[520px] text-[15px] leading-relaxed text-slate">{persona.bio}</p>
          )}
        </div>
      </div>

      {/* Vehicles */}
      {listed.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="font-display text-[22px] font-extrabold">
            {persona.name.split(" ")[0]}&apos;s cars
          </h2>
          <div className="flex flex-col gap-3">
            {listed.map((v, i) => (
              <VehicleCard key={v.id} vehicle={v} layout="row" priority={i === 0} />
            ))}
          </div>
        </div>
      )}

      {listed.length === 0 && (
        <p className="text-[15px] text-slate">No cars listed yet.</p>
      )}
    </div>
  );
}
