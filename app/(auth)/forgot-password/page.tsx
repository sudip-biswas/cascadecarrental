import type { Metadata } from "next";
import { AuthCard, AuthPanel } from "@/components/auth/AuthPanel";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const instant = false;
export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthPanel tone="sky" title="Reset your password." />
      <AuthCard title="Forgot password?">
        <p className="text-[15px] text-slate">
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>
        <ForgotPasswordForm />
      </AuthCard>
    </>
  );
}
