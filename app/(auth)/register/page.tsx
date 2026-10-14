import type { Metadata } from "next";
import { KeyRound, MessageSquare, Search } from "lucide-react";
import { AuthCard, AuthPanel } from "@/components/auth/AuthPanel";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { safeRedirect } from "@/lib/utils";

export const instant = false;

export const metadata: Metadata = { title: "Make an account" };

const perks = [
  { icon: Search, label: "Find a car near you" },
  { icon: MessageSquare, label: "Talk to the host before you book" },
  { icon: KeyRound, label: "List your own car when you're ready" },
];

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { redirectTo } = await searchParams;
  const next = safeRedirect(typeof redirectTo === "string" ? redirectTo : undefined);

  return (
    <>
      <AuthPanel tone="mint" title="One account for driving and hosting.">
        <ul className="grid gap-2.5 sm:grid-cols-3">
          {perks.map(({ icon: Icon, label }) => (
            <li key={label} className="flex flex-col gap-3 rounded-[22px] bg-white p-4">
              <Icon className="size-[26px]" strokeWidth={1.75} />
              <span className="text-[15px] font-bold">{label}</span>
            </li>
          ))}
        </ul>
      </AuthPanel>
      <AuthCard title="Make an account">
        <RegisterForm redirectTo={next} />
      </AuthCard>
    </>
  );
}
