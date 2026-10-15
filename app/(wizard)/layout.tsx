import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NO_INDEX } from "@/lib/site";

/** Private pages: nothing here belongs in search results. */
export const metadata = NO_INDEX;

export const instant = false;

/** Listing a car is full screen: the wizard brings its own header and footer bar. */
export default async function WizardLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/host/vehicles/new");

  return <div className="flex min-h-dvh flex-1 flex-col">{children}</div>;
}
