import { redirect } from "next/navigation";

/** Pickup spots now live on the Pickup and hours page. */
export default function LocationsPage() {
  redirect("/host/hours");
}
