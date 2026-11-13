import type { Metadata } from "next";
import { Container } from "@/components/kit";

export const metadata: Metadata = {
  title: "Terms of Service — Cascade Car Rental",
  description: "Terms of service for Cascade Car Rental, operated by Cascade Fleet LLC.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <Container className="max-w-2xl py-12">
      <h1 className="font-display text-4xl font-extrabold">Terms of Service</h1>
      <p className="mt-2 text-slate">Last updated: November 2026</p>

      <div className="prose prose-slate mt-8 max-w-none">
        <p>
          Cascade Car Rental is operated by <strong>Cascade Fleet LLC</strong>, a Washington-licensed
          rental car company (WA rental car registration #R64728), based near Seattle-Tacoma
          International Airport.
        </p>

        <h2>1. Eligibility</h2>
        <p>
          To rent a vehicle you must be at least 21 years old, hold a valid driver&apos;s licence,
          and present a payment card in your name. Drivers aged 21–24 pay a young driver fee per day
          for most vehicles, as shown on the vehicle listing and at checkout.
        </p>

        <h2>2. Reservations and Payment</h2>
        <p>
          All Cascade vehicles are instant book. Your reservation is confirmed the moment you
          complete checkout. The total shown at checkout — including tax — is the amount charged.
          We accept major credit and debit cards via Stripe.
        </p>

        <h2>3. Deposit Hold</h2>
        <p>
          A <strong>$250 refundable security hold</strong> is placed on your payment card at
          pick-up. The hold is released after the vehicle is returned in the agreed condition.
          The hold is waived for guests who select the Complete protection plan.
        </p>

        <h2>4. Cancellation</h2>
        <p>
          Flexible-rate bookings may be cancelled for a full refund up to 24 hours before the
          trip starts. Non-refundable rates are not eligible for a refund after booking.
          Cancellation terms are shown on each vehicle listing before you book.
        </p>

        <h2>5. Protection Plans</h2>
        <p>
          Protection plans (Basic, Standard, Complete) are damage waivers offered directly by
          Cascade Fleet LLC — not third-party insurance policies. By selecting a plan at checkout
          you agree to the coverage terms described on the listing page. Plans cover accidental
          damage up to the out-of-pocket limit for your selected tier.
        </p>

        <h2>6. Post-Trip Charges</h2>
        <p>
          Charges for damage, excess cleaning, fuel, tolls, or traffic tickets may be applied
          within the windows stated in the Rules of the Road on each listing. You will receive
          notice of any charge and may dispute it through your trip page.
        </p>

        <h2>7. Mileage</h2>
        <p>
          Each vehicle includes a set number of miles per day. Additional miles are charged at
          the per-mile rate shown on the listing. Mileage is logged at pick-up and return.
        </p>

        <h2>8. Pick-Up and Return</h2>
        <p>
          All vehicles are picked up and returned at the{" "}
          <strong>DoubleTree by Hilton Seattle Airport, 18740 International Blvd, SeaTac WA 98188</strong>.
          A one-hour grace period applies to late returns; after that a late fee applies as
          described in the Rules of the Road.
        </p>

        <h2>9. Prohibited Uses</h2>
        <p>
          Vehicles may not be used for commercial rideshare (Uber, Lyft), towing, off-road
          driving, racing, or transport across international borders without prior written approval.
          Smoking in vehicles is prohibited.
        </p>

        <h2>10. Contact</h2>
        <p>
          Cascade Fleet LLC · 18740 International Blvd, SeaTac WA 98188
          <br />
          Phone: <a href="tel:+16502724085">(650) 272-4085</a>
        </p>
      </div>
    </Container>
  );
}
