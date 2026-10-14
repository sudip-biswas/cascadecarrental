import { Suspense } from "react";
import { getGuestNav } from "@/lib/account";
import { Container } from "@/components/kit";
import { Logo } from "./Logo";
import { NavLinks, NavSearch } from "./GuestNavbarClient";
import { PhoneTabs } from "./PhoneTabs";

export async function GuestNavbar() {
  const account = await getGuestNav();
  return (
    <header className="bg-white">
      <Container className="flex items-center gap-4 py-3.5">
        <Logo />
        <Suspense fallback={<div className="hidden flex-[1_1_280px] md:block" />}>
          <NavSearch />
        </Suspense>
        <NavLinks account={account} />
      </Container>
    </header>
  );
}

export async function GuestPhoneTabs() {
  const account = await getGuestNav();
  return <PhoneTabs mode="guest" signedIn={!!account} inboxBadge={account?.unread ?? 0} />;
}
