import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";

export const instant = false;

export const metadata = { title: "Ratings & reviews" };

export default async function HostRatingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get reviews for host's vehicles
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id")
    .eq("host_id", user.id);

  const vehicleIds = vehicles?.map((v) => v.id) ?? [];

  const { data: reviewsRaw } =
    vehicleIds.length > 0
      ? await supabase
          .from("reviews")
          .select("*, reviewer:profiles!reviewer_id(full_name, avatar_url), vehicles(make, model, year)")
          .in("vehicle_id", vehicleIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  type ReviewRow = {
    id: string;
    created_at: string;
    rating_overall: number;
    body: string | null;
    host_reply: string | null;
    reviewer: { full_name: string; avatar_url: string | null } | null;
    vehicles: { make: string; model: string; year: number } | null;
  };
  const reviews = reviewsRaw as ReviewRow[] | null;

  const avgRating =
    reviews && reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating_overall, 0) / reviews.length
      : 0;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-xl font-bold text-cascade-900">Ratings & reviews</h1>

      {/* Summary */}
      <div className="bg-white border border-border rounded-xl p-6 flex items-center gap-6">
        <div className="text-center">
          <p className="text-5xl font-bold text-cascade-900">
            {avgRating > 0 ? avgRating.toFixed(2) : "—"}
          </p>
          <div className="flex justify-center mt-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  i < Math.round(avgRating)
                    ? "fill-summit-500 text-summit-500"
                    : "text-border"
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {reviews?.length ?? 0} reviews
          </p>
        </div>
      </div>

      {/* Reviews list */}
      {!reviews?.length ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No reviews yet. Complete your first trip to receive reviews.
        </div>
      ) : (
        <div className="space-y-4">
          {(reviews as any[]).map((review) => (
            <div key={review.id} className="bg-white border border-border rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={review.reviewer?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs bg-cascade-100 text-cascade-700">
                    {review.reviewer?.full_name?.[0]?.toUpperCase() ?? "G"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium text-cascade-900">
                    {review.reviewer?.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {review.vehicles?.make} {review.vehicles?.model} ·{" "}
                    {formatDate(review.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${
                        i < review.rating_overall
                          ? "fill-summit-500 text-summit-500"
                          : "text-border"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {review.body && (
                <p className="text-sm text-muted-foreground">{review.body}</p>
              )}

              {review.host_reply && (
                <div className="bg-cascade-100 rounded-lg p-3 text-sm">
                  <p className="font-medium text-cascade-900 mb-1">Your response</p>
                  <p className="text-muted-foreground">{review.host_reply}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
