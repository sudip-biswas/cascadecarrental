import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { AuthCard, AuthPanel } from "@/components/auth/AuthPanel";
import { Button } from "@/components/ui/button";
import { safeRedirect } from "@/lib/utils";

export const instant = false;

export default async function ConfirmPage({ searchParams }: PageProps<"/confirm">) {
  const { token_hash, next, email } = await searchParams;

  if (!token_hash || typeof token_hash !== "string") {
    redirect("/login");
  }

  const nextUrl = safeRedirect(typeof next === "string" ? next : undefined);
  const callbackHref = `/auth/callback?token_hash=${encodeURIComponent(token_hash)}&type=magiclink&next=${encodeURIComponent(nextUrl)}`;

  return (
    <>
      <AuthPanel tone="mint" title="Your trip is ready.">
        <ul className="grid gap-2.5">
          <li className="flex flex-col gap-3 rounded-[22px] bg-white p-4">
            <CalendarCheck className="size-[26px]" strokeWidth={1.75} />
            <span className="text-[15px] font-bold">View and manage your booking</span>
          </li>
        </ul>
      </AuthPanel>
      <AuthCard title="Continue to your trip">
        {email && typeof email === "string" && (
          <p className="text-[15px] text-slate">
            Signing you in as <strong>{email}</strong>.
          </p>
        )}
        <Button asChild size="lg" className="h-[52px] w-full text-[17px]">
          <Link href={callbackHref}>View your booking</Link>
        </Button>
        <p className="text-[13px] leading-snug text-slate">
          This link is single-use. If it has expired,{" "}
          <Link href="/login" className="underline">
            sign in here
          </Link>
          .
        </p>
      </AuthCard>
    </>
  );
}
