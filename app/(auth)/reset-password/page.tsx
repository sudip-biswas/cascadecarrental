import type { Metadata } from "next";
import { AuthCard, AuthPanel } from "@/components/auth/AuthPanel";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const instant = false;
export const metadata: Metadata = { title: "Set new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthPanel tone="mint" title="Choose a new password." />
      <AuthCard title="Set new password">
        <ResetPasswordForm />
      </AuthCard>
    </>
  );
}
