import type { Metadata, Viewport } from "next";
import { Geist, Manrope } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Cascade: rent a car from a local host",
    template: "%s | Cascade",
  },
  description:
    "Rent cars from people around Seattle. See the full price up front, book in a few taps, and pick up from the host.",
  keywords: ["car rental", "rent a car", "peer to peer car rental", "seattle", "cascade"],
};

export const viewport: Viewport = {
  themeColor: "#f3f4f6",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
