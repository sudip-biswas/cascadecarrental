import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadLocations } from "@/lib/locations";
import type { Vehicle, VehicleImage } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { EmptyState, PageTitle } from "@/components/kit";
import { coverUrl } from "@/components/host/bits";
import { LocationsTable, type HomeRow } from "@/components/host/locations/LocationsTable";

export const instant = false;
export const metadata = { title: "Locations" };

type CarRow = Pick<Vehicle, "id" | "make" | "model" | "location_name" | "location_address"> & {
  vehicle_images: Pick<VehicleImage, "url" | "is_cover" | "position">[];
};

export default async function LocationsPage() {
  const user = await getUser();
  if (!user) redirect("/login?redirectTo=/host/locations");

  // Addresses are private: read them server-side, scoped to this host.
  const admin = createAdminClient();
  const [{ data }, locations] = await Promise.all([
    admin
      .from("vehicles")
      .select("id, make, model, location_name, location_address, vehicle_images(url, is_cover, position)")
      .eq("host_id", user.id)
      .neq("status", "suspended")
      .order("created_at", { ascending: true })
      .overrideTypes<CarRow[], { merge: false }>(),
    loadLocations(admin, user.id),
  ]);
  const cars = data ?? [];

  if (cars.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
        <PageTitle title="Locations" />
        <EmptyState
          title="No cars yet"
          body="Once you list a car, add the spots where guests can pick it up, like the airport or a hotel nearby."
          action={
            <Button asChild>
              <Link href="/host/vehicles/new">List a car</Link>
            </Button>
          }
        />
      </div>
    );
  }

  // Each car's own spot, grouped by address, like Turo's home rows.
  const homes = new Map<string, HomeRow>();
  for (const car of cars) {
    const address = car.location_address?.trim() || car.location_name;
    const row = homes.get(address) ?? { address, carIds: [] };
    row.carIds.push(car.id);
    homes.set(address, row);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4">
      <PageTitle
        title="Locations"
        lead="Where guests can get your cars: each car's home spot, named spots like the airport, and delivery to their address."
      />
      <LocationsTable
        hostId={user.id}
        locations={locations}
        homes={[...homes.values()]}
        cars={cars.map((c) => ({ id: c.id, make: c.make, model: c.model, cover: coverUrl(c.vehicle_images) }))}
      />
    </div>
  );
}
