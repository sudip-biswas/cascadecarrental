"use client";

import { useState, type ComponentType } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/kit";
import { cn } from "@/lib/utils";
import type { FilterOptions } from "./listings";
import { FILTER_KEYS, filterCount, parseSearchParams } from "./params";
import {
  DeliverySection,
  FeaturesSection,
  FuelSection,
  MakeSection,
  MilesSection,
  MoreSection,
  MpgSection,
  PriceSection,
  SeatsSection,
  SortSection,
  TransmissionSection,
  TypeSection,
  YearsSection,
  showLabel,
  useDraft,
  useSearchStats,
  type SectionProps,
} from "./FilterSections";

const SECTIONS: { title: string; Section: ComponentType<SectionProps> }[] = [
  { title: "Sort by", Section: SortSection },
  { title: "Price per day", Section: PriceSection },
  { title: "Vehicle type", Section: TypeSection },
  { title: "Make and model", Section: MakeSection },
  { title: "Years", Section: YearsSection },
  { title: "Seats", Section: SeatsSection },
  { title: "Fuel efficiency", Section: MpgSection },
  { title: "Transmission", Section: TransmissionSection },
  { title: "Fuel type", Section: FuelSection },
  { title: "Features", Section: FeaturesSection },
  { title: "Miles included", Section: MilesSection },
  { title: "Delivery", Section: DeliverySection },
  { title: "More", Section: MoreSection },
];

/** Every filter in one sheet: centred on desktop, up from the bottom on a phone. */
export function AllFilters({
  options,
  className,
  ...props
}: { options: FilterOptions; className?: string } & Record<`data-${string}`, string>) {
  const searchParams = useSearchParams();
  const count = filterCount(parseSearchParams(Object.fromEntries(searchParams)));
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        {...props}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-11 shrink-0 items-center gap-2 rounded-[12px] px-3.5 text-[15px] font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cobalt",
          count ? "bg-ink text-white hover:bg-graphite" : "bg-white text-ink hover:bg-line",
          className
        )}
      >
        <SlidersHorizontal className="size-[18px]" strokeWidth={2} />
        All filters
        {count > 0 && (
          <span className="figures flex size-5 items-center justify-center rounded-[6px] bg-white text-[12px] font-extrabold text-ink">
            {count}
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        {open && <Sheet options={options} onDone={() => setOpen(false)} />}
      </Dialog>
    </>
  );
}

function Sheet({ options, onDone }: { options: FilterOptions; onDone: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { draft, set, filters } = useDraft(Object.fromEntries(searchParams));
  const { stats, loading } = useSearchStats(draft, true);

  function apply() {
    const qs = new URLSearchParams(draft).toString();
    router.push(qs ? `/search?${qs}` : "/search", { scroll: false });
    onDone();
  }

  return (
    <DialogContent
      showCloseButton={false}
      className="top-auto bottom-0 left-0 flex max-h-[92dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-b-none p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-h-[88dvh] sm:max-w-[600px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]"
    >
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-2 sm:px-6">
        <DialogClose asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Close">
            <X />
          </Button>
        </DialogClose>
        <DialogTitle className="text-[19px] font-extrabold">All filters</DialogTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => set(Object.fromEntries([...FILTER_KEYS, "sort"].map((k) => [k, null])))}
        >
          Reset
        </Button>
      </header>
      <DialogDescription className="sr-only">Narrow down the cars and choose their order.</DialogDescription>
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 pt-2 pb-6 sm:px-7">
        {SECTIONS.map(({ title, Section }, i) => (
          <section key={title} className="flex flex-col gap-3">
            {i > 0 && <Divider className="mb-2" />}
            <h3 className="text-[19px] leading-tight font-extrabold">{title}</h3>
            <Section filters={filters} set={set} options={options} stats={stats} />
          </section>
        ))}
      </div>
      <footer className="flex items-center justify-end gap-3 border-t border-line px-4 py-3 sm:px-6">
        <Button
          size="lg"
          onClick={apply}
          disabled={stats?.count === 0}
          aria-busy={loading}
          className="w-full sm:w-auto"
        >
          {showLabel(stats)}
        </Button>
      </footer>
    </DialogContent>
  );
}
