import { Container } from "@/components/kit";

export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy>
      <section className="bg-sky py-10 sm:pb-12">
        <Container className="flex flex-col gap-4">
          <div className="h-10 w-24 rounded-[12px] bg-white/70" />
          <div className="h-7 w-32 rounded-[8px] bg-white/70" />
          <div className="h-[88px] w-[min(100%,640px)] rounded-[18px] bg-white/70" />
        </Container>
      </section>
      <Container className="flex flex-wrap items-start gap-4 py-6">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-3.5">
          <div className="h-48 rounded-[28px] bg-white" />
          <div className="h-72 rounded-[28px] bg-white" />
        </div>
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-3.5">
          <div className="h-28 rounded-[28px] bg-white" />
          <div className="h-64 rounded-[28px] bg-white" />
        </div>
      </Container>
    </div>
  );
}
