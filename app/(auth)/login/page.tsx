import type { Metadata } from "next";
import { CalendarCheck, MessageSquare } from "lucide-react";
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
