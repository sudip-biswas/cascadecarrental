import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CHECK_IN } from "@/lib/guest-instructions";

/** One line on the host's trip page saying how the guest gets the keys. */
export async function InstructionsHostNote({ vehicleId }: { vehicleId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("vehicle_guest_instructions")
    .select("check_in_method, pickup_instructions")
    .eq("vehicle_id", vehicleId)
    .maybeSingle();
  const href = `/host/vehicles/${vehicleId}#guest-instructions`;

  if (!data) {
    return (
      <span className="text-slate">
        No guest instructions yet.{" "}
        <Link href={href} className="font-bold text-cobalt hover:underline">
          Add them
        </Link>
      </span>
    );
  }
  return (
    <span className="text-slate">
      Guests see: {CHECK_IN[data.check_in_method].guestLine}{" "}
      <Link href={href} className="font-bold text-cobalt hover:underline">
        {data.pickup_instructions ? "Edit instructions" : "Add pick-up notes"}
      </Link>
    </span>
  );
}
