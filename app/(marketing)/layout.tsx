export const instant = false;

import { GuestNavbar } from "@/components/layout/GuestNavbar";
import { Footer } from "@/components/layout/Footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GuestNavbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
