import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HostCalendar } from "@/components/host/CalendarView";

export const instant = false;

export const metadata = { title: "Calendar" };

export default async function HostCalendarPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get host's vehicles
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, make, model, year")
    .eq("host_id", user.id)
    .order("created_at", { ascending: false });

  // Get all trips for host's vehicles
  const vehicleIds = vehicles?.map((v) => v.id) ?? [];

  const { data: trips } =
    vehicleIds.length > 0
      ? await supabase
          .from("trips")
          .select("id, vehicle_id, starts_at, ends_at, status, profiles!guest_id(full_name)")
          .in("vehicle_id", vehicleIds)
          .not("status", "in", '("cancelled_guest","cancelled_host")')
      : { data: [] };

  const { data: blocked } =
    vehicleIds.length > 0
      ? await supabase
          .from("vehicle_availability")
          .select("id, vehicle_id, blocked_from, blocked_to, reason")
          .in("vehicle_id", vehicleIds)
      : { data: [] };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-cascade-900 mb-6">Calendar</h1>
      <HostCalendar
        vehicles={vehicles ?? []}
        trips={trips ?? []}
        blocked={blocked ?? []}
        userId={user.id}
      />
    </div>
  );
}
