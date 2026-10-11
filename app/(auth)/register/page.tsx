import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const instant = false;

export const metadata: Metadata = {
  title: "Create account",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  return <RegisterForm redirectTo={redirectTo ?? "/"} />;
}
