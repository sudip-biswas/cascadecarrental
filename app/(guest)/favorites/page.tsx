import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart } from "lucide-react";
import { createClient, getUser } from "@/lib/supabase/server";
import { NO_INDEX } from "@/lib/site";
import { pluralize } from "@/lib/utils";
import { Container, EmptyState } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { VehicleCard } from "@/components/search/VehicleCard";
import { withTodayPrices } from "@/components/search/prices";
import { LISTED_VEHICLE_SELECT, type ListedVehicle } from "@/components/search/vehicle";

export const instant = false;

export const metadata: Metadata = { title: "Favorites", ...NO_INDEX };

export default async function FavoritesPage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login?redirectTo=/favorites");

  const { data } = await supabase
    .from("favorites")
    .select(`created_at, vehicle:vehicles(${LISTED_VEHICLE_SELECT})`)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as { vehicle: ListedVehicle | null }[];
  // A car the host has unlisted since can't be booked, so it drops off until it's back.
  const cars = await withTodayPrices(rows.flatMap((r) => (r.vehicle?.status === "listed" ? [r.vehicle] : [])));
  const hidden = rows.length - cars.length;

  return (
    <Container className="flex flex-col gap-[18px] pt-9 pb-16">
      <div className="flex flex-col gap-2">
        <h1 className="headline text-[clamp(44px,6vw,88px)] leading-none">Favorites</h1>
        {cars.length > 0 && (
          <p className="text-[17px] text-slate">
            {pluralize(cars.length, "saved car")}
            {hidden > 0 && `. ${pluralize(hidden, "other")} ${hidden === 1 ? "isn't" : "aren't"} listed right now.`}
          </p>
        )}
      </div>

      {cars.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {cars.map((car, i) => (
            <VehicleCard
              key={car.id}
              vehicle={car}
              layout="row"
              priority={i < 2}
              favorite={{ userId: user.id, saved: true }}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Heart />}
          title="No favorites yet"
          body={
            hidden > 0
              ? "The cars you saved aren't listed right now. Tap the heart on any car to save it here."
              : "Tap the heart on any car to save it here, so it's easy to find again."
          }
          action={
            <Button asChild>
              <Link href="/search">Find a car</Link>
            </Button>
          }
        />
      )}
    </Container>
  );
}
