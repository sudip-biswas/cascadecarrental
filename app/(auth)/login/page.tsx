import type { Metadata } from "next";
import { CalendarCheck, CarFront, MessageSquare } from "lucide-react";
import { AuthCard, AuthPanel } from "@/components/auth/AuthPanel";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeRedirect } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = { title: "Sign in" };

const waiting = [
  { icon: CalendarCheck, label: "Your trips and bookings" },
  { icon: MessageSquare, label: "Messages with hosts" },
  { icon: CarFront, label: "Your cars, if you host" },
];

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { redirectTo, message, error } = await searchParams;
  const next = safeRedirect(typeof redirectTo === "string" ? redirectTo : undefined);

  return (
    <>
      <AuthPanel tone="sky" title="Welcome back.">
        <ul className="grid gap-2.5 sm:grid-cols-3">
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
          <p role="alert" className="rounded-[14px] bg-error-soft px-3.5 py-3 text-[15px] font-semibold text-error">
            That sign-in link didn&apos;t work. It may have expired, so try again.
          </p>
        )}
        <LoginForm redirectTo={next} />
      </AuthCard>
    </>
  );
}
