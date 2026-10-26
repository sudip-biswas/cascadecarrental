import { Container } from "@/components/kit";

export default function Loading() {
  return (
    <Container className="flex max-w-[760px] animate-pulse flex-col gap-4 pt-6 pb-12 sm:pt-8" aria-busy>
      <div className="h-9 w-24 rounded-[12px] bg-white" />
      <div className="h-[560px] rounded-[28px] bg-white" />
    </Container>
  );
}
