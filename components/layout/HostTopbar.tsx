import Link from "next/link";
import { LogoMark } from "./Logo";

/** Phone and tablet header for hosting. Desktop uses the sidebar. */
export function HostTopbar() {
  return (
    <header className="flex items-center justify-between gap-3 bg-white px-4 py-3 lg:hidden">
      <Link href="/host" className="flex items-center gap-2.5">
        <LogoMark size={32} />
        <span className="font-display text-[22px] font-extrabold tracking-[-0.03em]">Cascade</span>
        <span className="rounded-[6px] bg-butter px-1.5 py-[3px] text-[12px] font-extrabold">Host</span>
      </Link>
      <Link href="/" className="rounded-[12px] bg-board px-3 py-2.5 text-sm font-bold">
        Switch to renting
      </Link>
    </header>
  );
}
