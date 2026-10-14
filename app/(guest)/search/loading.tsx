import { Container } from "@/components/kit";
import { VehicleGridSkeleton } from "@/components/search/VehicleCardSkeleton";

export default function Loading() {
  return (
    <Container className="flex flex-col gap-4 pt-5 pb-16">
      <div className="h-[76px] animate-pulse rounded-[24px] bg-white" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-11 w-24 animate-pulse rounded-[12px] bg-white" />
        ))}
      </div>
      <div className="my-1 h-10 w-72 animate-pulse rounded-[12px] bg-line" />
      <VehicleGridSkeleton layout="row" count={4} />
    </Container>
  );
}
