import { createClient } from "@/lib/supabase/server";
import { GuestInstructionsForm } from "./GuestInstructionsForm";

/** Guest instructions section on the host's car page. */
export async function GuestInstructions({ vehicleId }: { vehicleId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("vehicle_guest_instructions").select("*").eq("vehicle_id", vehicleId).maybeSingle();

  return (
    <section id="guest-instructions" className="scroll-mt-4 rounded-[30px] bg-white p-5 sm:p-6">
      <GuestInstructionsForm vehicleId={vehicleId} initial={data} />
    </section>
  );
}
