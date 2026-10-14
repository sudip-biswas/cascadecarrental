import type { ReactNode } from "react";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/utils";

/** The coloured tile beside the form: logo, big headline, and whatever goes under it. */
export function AuthPanel({
  tone,
  title,
  children,
}: {
  tone: "sky" | "mint";
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-[1_1_480px] flex-col justify-between gap-8 rounded-[36px] p-6 sm:p-8 lg:min-h-[560px]",
        tone === "sky" ? "bg-sky" : "bg-mint"
      )}
    >
      <Logo />
      <h1 className="headline text-[clamp(48px,6.6vw,104px)] leading-[0.98]">{title}</h1>
      {children}
    </section>
  );
}

/** The white tile holding the form. */
export function AuthCard({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-[1_1_440px] items-center justify-center rounded-[36px] bg-white px-5 py-8 sm:p-10">
      <div className="flex w-full max-w-[420px] flex-col gap-3">
        <h2 className="mb-2.5 text-[40px] leading-[1.12] tracking-[-0.035em]">{title}</h2>
        {children}
      </div>
    </section>
  );
}
