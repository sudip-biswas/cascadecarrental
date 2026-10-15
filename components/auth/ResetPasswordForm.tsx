"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "./Field";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "Passwords don't match.",
  path: ["confirm"],
});

type FormData = z.infer<typeof schema>;

export function ResetPasswordForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError(null);
    const { error } = await createClient().auth.updateUser({ password: data.password });
    if (error) {
      setServerError(error.message);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3">
      <Field
        id="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <Field
        id="confirm"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={errors.confirm?.message}
        {...register("confirm")}
      />
      {serverError && <FormError>{serverError}</FormError>}
      <Button type="submit" size="lg" className="mt-1.5 h-[58px] rounded-[16px]" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Set password"}
      </Button>
    </form>
  );
}
