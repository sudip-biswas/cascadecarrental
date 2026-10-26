import { Container } from "@/components/kit";
import { VehicleGridSkeleton } from "@/components/search/VehicleCardSkeleton";

export default function Loading() {
  return (
    <Container className="flex flex-col gap-[18px] pt-9 pb-16" aria-busy>
      <div className="h-[72px] w-[min(100%,360px)] animate-pulse rounded-[18px] bg-line" />
      <VehicleGridSkeleton layout="row" count={4} />
    </Container>
  );
}
