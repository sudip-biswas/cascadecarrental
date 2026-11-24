import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarCheck, MessageSquare } from "lucide-react";
import { AuthCard, AuthPanel } from "@/components/auth/AuthPanel";
import { LoginForm } from "@/components/auth/LoginForm";
import { ResendLink } from "@/components/auth/ResendLink";
import { safeRedirect } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = { title: "Sign in" };

const waiting = [
  { icon: CalendarCheck, label: "Your trips and bookings" },
  { icon: MessageSquare, label: "Messages with Cascade" },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { redirectTo, message, error, email, next: nextParam } = await searchParams;
  const next = safeRedirect(typeof redirectTo === "string" ? redirectTo : undefined);
  const resendEmail = typeof email === "string" ? email : null;
  const resendNext = typeof nextParam === "string" ? nextParam : next;

  return (
    <>
      <AuthPanel tone="sky" title="Welcome back.">
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {waiting.map(({ icon: Icon, label }) => (
            <li key={label} className="flex flex-col gap-3 rounded-[22px] bg-white p-4">
              <Icon className="size-[26px]" strokeWidth={1.75} />
              <span className="text-[15px] font-bold">{label}</span>
            </li>
          ))}
        </ul>
      </AuthPanel>
      <AuthCard title="Sign in">
        <div className="rounded-[14px] bg-board px-3.5 py-3 text-[14px] leading-snug text-slate">
          <p className="font-semibold text-ink">No account needed to book.</p>
          <p className="mt-0.5">Every car supports guest checkout — just pick your dates and pay.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Link href="/seattle" className="flex items-center gap-1 text-[13px] font-bold text-ink hover:text-cobalt">
              Browse cars <ArrowRight className="size-3.5" strokeWidth={2} />
            </Link>
            <span aria-hidden className="text-line">·</span>
            <Link href="/contact" className="flex items-center gap-1 text-[13px] font-bold text-ink hover:text-cobalt">
              Ask a question <ArrowRight className="size-3.5" strokeWidth={2} />
            </Link>
          </div>
        </div>
        {message === "check_email" && (
          <p role="status" className="rounded-[14px] bg-mint px-3.5 py-3 text-[15px] font-semibold text-mint-ink">
            Check your email. Tap the link we sent, then sign in here.
          </p>
        )}
        {error === "auth_callback_failed" && (
          <div role="alert" className="flex flex-col gap-2 rounded-[14px] bg-error-soft px-3.5 py-3">
            <p className="text-[15px] font-semibold text-error">
              That sign-in link didn&apos;t work. It may have expired.
            </p>
            {resendEmail && <ResendLink email={resendEmail} next={resendNext} />}
          </div>
        )}
        <LoginForm redirectTo={next} />
      </AuthCard>
    </>
  );
}
