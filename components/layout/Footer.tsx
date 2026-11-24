import Link from "next/link";
import { RENTAL_PAGES } from "@/lib/rentals";
import { Container } from "@/components/kit";
import { Logo } from "./Logo";

const links = [
  { href: "/search", label: "Find a car" },
  { href: "/contact", label: "Contact us" },
  { href: "/host/vehicles/new", label: "List your car" },
  { href: "/trips", label: "Your trips" },
];

const rentals = [{ href: "/seattle", label: "All cars" }, ...RENTAL_PAGES.map((p) => ({ href: `/seattle/${p.slug}`, label: p.label }))];

export function Footer() {
  return (
    <footer className="mt-auto bg-ink text-white">
      <Container className="flex flex-wrap items-center justify-between gap-6 py-11">
        <Logo onDark size="sm" />
        <nav className="flex flex-wrap gap-x-[22px] gap-y-1.5 text-[15px]">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} className="py-2.5 hover:text-sky">
              {label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Car rental in Seattle" className="flex w-full flex-wrap items-center gap-x-[22px] gap-y-1.5 text-[15px]">
          <span className="font-bold">Car rental in Seattle</span>
          {rentals.map(({ href, label }) => (
            <Link key={href} href={href} className="py-2.5 text-[#c6c9cf] hover:text-sky">
              {label}
            </Link>
          ))}
        </nav>
        <p className="w-full text-sm text-[#9ca0a8]">© Cascade Car Rental · Seattle, WA</p>
        <p className="w-full text-sm text-[#9ca0a8]">Operated by Cascade Fleet LLC · WA rental car registration #R64728</p>
        <div className="flex w-full flex-wrap gap-x-5 gap-y-1 text-sm text-[#9ca0a8]">
          <Link href="/about" className="hover:text-sky">About</Link>
          <Link href="/terms" className="hover:text-sky">Terms</Link>
          <Link href="/privacy" className="hover:text-sky">Privacy</Link>
          <a href="tel:+16502724085" className="hover:text-sky">(650) 272-4085</a>
        </div>
      </Container>
    </footer>
  );
}
