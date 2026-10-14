import { Container } from "@/components/kit";

export default function Loading() {
  return (
    <div className="animate-pulse pb-16" aria-busy>
      <Container className="pt-6">
        <div className="h-10 w-48 rounded-[12px] bg-line" />
      </Container>
      <Container className="flex flex-wrap items-start gap-5 pt-5">
        <div className="flex min-w-0 flex-[999_1_600px] flex-col gap-3.5">
          <div className="h-[72px] w-[min(100%,460px)] rounded-[18px] bg-line" />
          <div className="h-56 rounded-[28px] bg-white" />
          <div className="h-44 rounded-[28px] bg-white" />
          <div className="h-64 rounded-[28px] bg-white" />
        </div>
        <div className="h-[520px] min-w-0 flex-[1_1_360px] rounded-[30px] bg-white" />
      </Container>
    </div>
  );
}
