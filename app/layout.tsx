import type { Metadata, Viewport } from "next";
import { Geist, Manrope } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { INDEXABLE, OPEN_GRAPH, SITE_NAME, SITE_URL } from "@/lib/site";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const DESCRIPTION =
  "Rent cars from people around Seattle. See the full price up front, book in a few taps, and pick up from the host.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Cascade: rent a car from a local host in Seattle",
    template: "%s | Cascade",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { ...OPEN_GRAPH, description: DESCRIPTION },
  twitter: { card: "summary_large_image" },
  robots: INDEXABLE ? undefined : { index: false, follow: false },
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
