import { Container } from "@/components/kit";
import { VehicleGridSkeleton } from "@/components/search/VehicleCardSkeleton";

export default function Loading() {
  return (
    <>
      <section className="bg-sky pt-8 pb-12 sm:pt-12 sm:pb-16">
        <Container className="flex flex-col gap-7">
          <div className="h-[clamp(96px,14vw,224px)] max-w-[760px] animate-pulse rounded-[24px] bg-white/60" />
          <div className="h-[84px] max-w-[760px] animate-pulse rounded-[24px] bg-white" />
        </Container>
      </section>
      <Container className="pt-14">
        <VehicleGridSkeleton count={3} />
      </Container>
    </>
  );
}
