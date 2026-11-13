import Link from "next/link";
import { MessageSquare, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Replaces the peer-host card for Cascade's own fleet vehicles. */
export function FleetCard({ messageHref }: { messageHref: string | null }) {
  return (
    <div className="flex flex-wrap items-start gap-4 rounded-[24px] bg-white p-4 sm:p-[18px]">
      <span
        aria-hidden
        className="flex size-16 items-center justify-center rounded-[18px] bg-mint font-display text-[26px] font-extrabold sm:size-20 sm:rounded-[22px]"
      >
        C
      </span>
      <span className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
        <span className="font-display text-[22px] font-extrabold sm:text-[24px]">Cascade Fleet LLC</span>
        <span className="text-[14px] text-slate">Licensed rental fleet · WA #R64728 · Sea-Tac Airport</span>
        <p className="mt-1 text-[15px] text-slate">
          We meet you at the DoubleTree by Hilton SeaTac with your car and keys — no counter, no queue.{" "}
          <a href="tel:+16502724085" className="font-semibold hover:underline">
            (650) 272-4085
          </a>
        </p>
      </span>
      <div className="flex flex-wrap gap-2 sm:flex-col">
        {messageHref && (
          <Button asChild variant="secondary">
            <Link href={messageHref}>
              <MessageSquare strokeWidth={1.75} />
              Message us
            </Link>
          </Button>
        )}
        <Button asChild variant="secondary">
          <a href="tel:+16502724085">
            <Phone strokeWidth={1.75} />
            Call us
          </a>
        </Button>
      </div>
    </div>
  );
}
