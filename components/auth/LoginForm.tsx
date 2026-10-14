"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { safeRedirect } from "@/lib/utils";
import { Field, FormError, OrDivider } from "./Field";
import { GoogleOAuthButton } from "./GoogleOAuthButton";

const schema = z.object({
  email: z.string().trim().email("Enter the email you signed up with."),
  password: z.string().min(1, "Enter your password."),
});

type FormData = z.infer<typeof schema>;

function friendlyError(message: string) {
  if (/invalid login credentials/i.test(message)) return "That email and password don't match.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first. The link is in your inbox.";
  return message;
}

export function LoginForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();
  const next = safeRedirect(redirectTo);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const { error } = await createClient().auth.signInWithPassword(data);
    if (error) {
      setServerError(friendlyError(error.message));
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <>
      <GoogleOAuthButton redirectTo={next} />
      <OrDivider>or with email</OrDivider>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
        <Field
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />
        {serverError && <FormError>{serverError}</FormError>}
        <Button type="submit" size="lg" className="mt-1.5 h-[58px] rounded-[16px]" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-2 text-center text-[15px] text-slate">
        New here?{" "}
        <Link
          href={next === "/" ? "/register" : `/register?redirectTo=${encodeURIComponent(next)}`}
          className="font-bold text-ink hover:text-cobalt"
        >
          Make an account
        </Link>
      </p>
    </>
  );
}
