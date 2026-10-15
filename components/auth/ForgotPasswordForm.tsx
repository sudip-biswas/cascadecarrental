"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "./Field";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

type FormData = z.infer<typeof schema>;

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error } = await createClient().auth.resetPasswordForEmail(data.email, { redirectTo });
    if (error) {
      setServerError(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p role="status" className="rounded-[14px] bg-mint px-3.5 py-3 text-[15px] font-semibold text-mint-ink">
        Check your inbox — we sent a reset link to your email.
      </p>
    );
  }

  return (
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
      {serverError && <FormError>{serverError}</FormError>}
      <Button type="submit" size="lg" className="mt-1.5 h-[58px] rounded-[16px]" disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
