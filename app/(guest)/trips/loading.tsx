import { Container } from "@/components/kit";

export default function Loading() {
  return (
    <Container className="flex animate-pulse flex-col gap-[18px] pt-9 pb-16" aria-busy>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="h-[72px] w-[min(100%,420px)] rounded-[18px] bg-line" />
        <div className="h-[54px] w-full rounded-[16px] bg-line sm:w-[360px]" />
      </div>
      <div className="flex flex-wrap gap-5 rounded-[32px] bg-white p-3">
        <div className="aspect-[4/3] w-full flex-[1_1_300px] rounded-[24px] bg-line sm:max-w-[420px]" />
        <div className="flex flex-[1_1_420px] flex-col gap-4 py-3">
          <div className="h-7 w-48 rounded-[8px] bg-line" />
          <div className="h-12 w-3/4 rounded-[12px] bg-line" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-16 rounded-[14px] bg-board" />
            <div className="h-16 rounded-[14px] bg-board" />
            <div className="h-16 rounded-[14px] bg-board" />
          </div>
        </div>
      </div>
    </Container>
  );
}
