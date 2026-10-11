import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="bg-cascade-900 text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1 space-y-4">
          <Logo size="sm" className="[&_span]:text-white [&_div]:bg-cascade-500" />
          <p className="text-sm text-cascade-300">
            Rent a car, not a rental car. Find the perfect vehicle from local hosts.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-cascade-300 uppercase tracking-wider">
            Guest
          </h3>
          <ul className="space-y-2 text-sm text-cascade-300">
            <li><Link href="/search" className="hover:text-white transition-colors">Search cars</Link></li>
            <li><Link href="/trips" className="hover:text-white transition-colors">My trips</Link></li>
            <li><Link href="/messages" className="hover:text-white transition-colors">Messages</Link></li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-cascade-300 uppercase tracking-wider">
            Host
          </h3>
          <ul className="space-y-2 text-sm text-cascade-300">
            <li><Link href="/host/vehicles" className="hover:text-white transition-colors">My listings</Link></li>
            <li><Link href="/host/calendar" className="hover:text-white transition-colors">Calendar</Link></li>
            <li><Link href="/host/business/earnings" className="hover:text-white transition-colors">Earnings</Link></li>
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-cascade-300 uppercase tracking-wider">
            Company
          </h3>
          <ul className="space-y-2 text-sm text-cascade-300">
            <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
            <li><Link href="/help" className="hover:text-white transition-colors">Help center</Link></li>
            <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-cascade-700 py-4">
        <p className="text-center text-xs text-cascade-500">
          © 2026 Cascade Car Rental, Inc. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
