import type { Metadata } from "next";
import { Container } from "@/components/kit";

export const metadata: Metadata = {
  title: "Privacy Policy — Cascade Car Rental",
  description: "Privacy policy for Cascade Car Rental, operated by Cascade Fleet LLC.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <Container className="max-w-2xl py-12">
      <h1 className="font-display text-4xl font-extrabold">Privacy Policy</h1>
      <p className="mt-2 text-slate">Last updated: November 2026</p>

      <div className="prose prose-slate mt-8 max-w-none">
        <p>
          Cascade Car Rental is operated by <strong>Cascade Fleet LLC</strong>. This policy explains
          what information we collect, how we use it, and your choices.
        </p>

        <h2>1. Information We Collect</h2>
        <ul>
          <li>
            <strong>Account information</strong> — name, email address, and password when you
            create an account.
          </li>
          <li>
            <strong>Booking information</strong> — trip dates, vehicle selected, and payment card
            details (processed and stored by Stripe — we do not store full card numbers).
          </li>
          <li>
            <strong>Driver verification</strong> — a photo of your driver&apos;s licence, collected
            after booking to verify eligibility.
          </li>
          <li>
            <strong>Usage data</strong> — pages visited, search queries, and device/browser
            information collected via cookies and analytics tools (Google Tag Manager / Google
            Analytics).
          </li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To process and manage your reservations.</li>
          <li>To verify driver eligibility and prevent fraud.</li>
          <li>To communicate about your trip, including pickup instructions and receipts.</li>
          <li>To improve the website and understand how guests use it.</li>
          <li>To comply with applicable laws and regulations.</li>
        </ul>

        <h2>3. Sharing</h2>
        <p>
          We do not sell your personal information. We share data only with service providers
          necessary to operate the platform: Stripe (payments), Supabase (database and
          authentication), Vercel (hosting), and Google (analytics). Each provider processes
          data under its own privacy policy.
        </p>

        <h2>4. Cookies</h2>
        <p>
          We use cookies for authentication (keeping you logged in) and analytics (understanding
          site traffic). You can disable cookies in your browser settings; this may affect login
          functionality.
        </p>

        <h2>5. Data Retention</h2>
        <p>
          Account and trip records are retained for as long as your account is active or as
          required by law. You may request deletion of your account by contacting us.
        </p>

        <h2>6. Your Rights</h2>
        <p>
          You may request access to, correction of, or deletion of your personal data at any
          time by emailing us or calling the number below.
        </p>

        <h2>7. Contact</h2>
        <p>
          Cascade Fleet LLC · 18740 International Blvd, SeaTac WA 98188
          <br />
          Phone: <a href="tel:+16502724085">(650) 272-4085</a>
        </p>
      </div>
    </Container>
  );
}
