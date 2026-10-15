import { Plus } from "lucide-react";
import type { Faq as FaqItem } from "@/lib/rentals";
import { JsonLd } from "./JsonLd";

/** Questions and answers, open to read in place and marked up for search. */
export function Faq({ items, title = "Questions" }: { items: FaqItem[]; title?: string }) {
  return (
    <section className="flex flex-col gap-4 sm:gap-5">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map(({ q, a }) => ({
            "@type": "Question",
            name: q,
            acceptedAnswer: { "@type": "Answer", text: a },
          })),
        }}
      />
      <h2 className="headline text-[28px] leading-[1.12] sm:text-[44px]">{title}</h2>
      <div className="flex flex-col gap-2">
        {items.map(({ q, a }) => (
          <details key={q} className="group rounded-[22px] bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-[17px] font-bold sm:p-[22px] sm:text-lg [&::-webkit-details-marker]:hidden">
              {q}
              <Plus className="size-5 shrink-0 transition-transform group-open:rotate-45" strokeWidth={2} />
            </summary>
            <p className="-mt-1 max-w-[70ch] px-5 pb-5 text-base leading-[1.5] text-slate sm:px-[22px] sm:pb-[22px]">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
