import type { Metadata } from "next";
import { ListingWizard } from "@/components/listing-wizard/WizardShell";

export const metadata: Metadata = { title: "List your car" };

export default function NewListingPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-cascade-900 mb-2">List your car</h1>
      <p className="text-muted-foreground mb-8">
        Complete each step to get your car listed on Cascade.
      </p>
      <ListingWizard />
    </div>
  );
}
