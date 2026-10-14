import { cn } from "@/lib/utils";

function Block({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded-[10px] bg-line", className)} />;
}

export function VehicleCardSkeleton({ layout = "tile" }: { layout?: "tile" | "row" }) {
  if (layout === "row") {
    return (
      <div className="flex flex-col gap-4 rounded-[26px] bg-white p-2.5 sm:flex-row">
        <Block className="aspect-[4/3] w-full shrink-0 rounded-[18px] sm:w-[240px]" />
        <div className="flex flex-1 flex-col gap-3 px-2 pb-2 sm:py-2 sm:pl-0">
          <Block className="h-7 w-1/2" />
          <Block className="h-4 w-2/3" />
          <Block className="h-6 w-3/4" />
          <Block className="mt-auto h-7 w-1/3 self-end" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3.5 rounded-[28px] bg-white px-2.5 pt-2.5 pb-5">
      <Block className="aspect-[4/3] w-full rounded-[20px]" />
      <div className="flex flex-col gap-2 px-2.5">
        <Block className="h-6 w-2/3" />
        <Block className="h-4 w-1/2" />
        <Block className="h-6 w-1/3" />
      </div>
    </div>
  );
}

export function VehicleGridSkeleton({ count = 6, layout = "tile" }: { count?: number; layout?: "tile" | "row" }) {
  return (
    <div className={cn("grid gap-4", layout === "row" ? "xl:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
      {Array.from({ length: count }, (_, i) => (
        <VehicleCardSkeleton key={i} layout={layout} />
      ))}
    </div>
  );
}
