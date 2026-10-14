"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn, safeRedirect } from "@/lib/utils";
import { Field, FormError, OrDivider } from "./Field";
import { GoogleOAuthButton } from "./GoogleOAuthButton";

const schema = z.object({
  fullName: z.string().trim().min(2, "Add your name, first and last."),
  email: z.string().trim().email("That doesn't look like an email."),
  password: z.string().min(8, "Use at least 8 characters."),
});

type FormData = z.infer<typeof schema>;

/** 0–4: length, then mixing letters, digits and symbols. */
function strength(password: string) {
  if (password.length < 8) return password.length ? 1 : 0;
  let score = 2;
  if (/[a-z]/i.test(password) && /\d/.test(password)) score++;
  if (password.length >= 12 && /[^a-z\d]/i.test(password)) score++;
  return score;
}

const strengthLabel = ["", "Too short.", "Fine. A number would help.", "Strong enough.", "Strong."];

export function RegisterForm({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();
  const next = safeRedirect(redirectTo);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const score = strength(useWatch({ control, name: "password" }) ?? "");

  async function onSubmit(data: FormData) {
    setServerError(null);
    const { data: result, error } = await createClient().auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { full_name: data.fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setServerError(
        /already registered/i.test(error.message)
          ? "There's already an account with that email. Sign in instead."
          : error.message
      );
      return;
    }
    // With email confirmation off, Supabase signs the person straight in.
    if (result.session) {
      router.replace(next);
      router.refresh();
      return;
    }
    router.push(`/login?message=check_email${next === "/" ? "" : `&redirectTo=${encodeURIComponent(next)}`}`);
  }

  return (
    <>
      <GoogleOAuthButton redirectTo={next} />
      <OrDivider>or with email</OrDivider>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
        <Field
          id="fullName"
          label="Your name"
          autoComplete="name"
          placeholder="First and last"
          error={errors.fullName?.message}
          {...register("fullName")}
        />
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
          autoComplete="new-password"
          error={errors.password?.message}
          {...register("password")}
        >
          {score > 0 && (
            <>
              <span className="mt-1.5 grid grid-cols-4 gap-1" aria-hidden>
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={cn("h-[5px] rounded-[3px]", i <= score ? "bg-ink" : "bg-line")} />
                ))}
              </span>
              <span className="text-[13px] text-slate">{strengthLabel[score]}</span>
            </>
          )}
        </Field>
        {serverError && <FormError>{serverError}</FormError>}
        <Button type="submit" size="lg" className="mt-1.5 h-[58px] rounded-[16px]" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-1.5 text-center text-[15px] text-slate">
        Already have one?{" "}
        <Link
          href={next === "/" ? "/login" : `/login?redirectTo=${encodeURIComponent(next)}`}
          className="font-bold text-ink hover:text-cobalt"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
