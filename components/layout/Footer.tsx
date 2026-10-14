import Link from "next/link";
import { Container } from "@/components/kit";
import { Logo } from "./Logo";

const links = [
  { href: "/search", label: "Find a car" },
  { href: "/host/vehicles/new", label: "List your car" },
  { href: "/trips", label: "Your trips" },
];

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
        <p className="w-full text-sm text-[#9ca0a8]">© Cascade Car Rental · Seattle, WA</p>
      </Container>
    </footer>
  );
}
