import { GuestNavbar } from "@/components/layout/GuestNavbar";
import { Footer } from "@/components/layout/Footer";

export const instant = false;

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GuestNavbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
