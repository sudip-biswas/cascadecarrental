import type { Metadata } from "next";
import { WizardLoader } from "@/components/listing-wizard/WizardLoader";

export const metadata: Metadata = { title: "List your car" };

export default function NewListingPage() {
  return <WizardLoader />;
}
