import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";

export const instant = false;

export const metadata: Metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; message?: string; error?: string }>;
}) {
  const { redirectTo, message, error } = await searchParams;

  return (
    <div className="w-full max-w-sm space-y-4">
      {message === "check_email" && (
        <div className="bg-alpine-500/10 border border-alpine-500/30 text-alpine-500 rounded-lg px-4 py-3 text-sm text-center">
          Check your email to confirm your account before signing in.
        </div>
      )}
      {error === "auth_callback_failed" && (
        <div className="bg-ember-500/10 border border-ember-500/30 text-ember-500 rounded-lg px-4 py-3 text-sm text-center">
          Authentication failed. Please try again.
        </div>
      )}
      <LoginForm redirectTo={redirectTo ?? "/"} />
    </div>
  );
}
