import { GuestNavbar, GuestPhoneTabs } from "@/components/layout/GuestNavbar";
import { Footer } from "@/components/layout/Footer";

export const instant = false;

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <GuestNavbar />
      <main className="flex-1">{children}</main>
      <Footer />
      <GuestPhoneTabs />
    </>
  );
}
