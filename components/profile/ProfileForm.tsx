"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const schema = z.object({
  full_name: z.string().trim().min(2, "Add your name, first and last."),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[+\d(][\d\s().-]{6,}$/.test(v), "That doesn't look like a phone number."),
  bio: z.string().trim().max(500, "Keep it under 500 characters."),
});

type FormData = z.infer<typeof schema>;

interface Props {
  profile: { id: string; full_name: string; phone: string | null; bio: string | null };
  email: string;
}

const box = "flex flex-col gap-0.5 rounded-[16px] px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-ink";
const labelText = "text-[13px] font-semibold text-slate";
const control = "w-full bg-transparent text-base font-semibold outline-none placeholder:font-normal placeholder:text-quiet";

export function ProfileForm({ profile, email }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: profile.full_name,
      phone: profile.phone ?? "",
      bio: profile.bio ?? "",
    },
  });

  async function onSubmit(data: FormData) {
    const { error } = await createClient()
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: data.phone || null,
        bio: data.bio || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);

    if (error) {
      toast.error("Couldn't save. Try again.");
      return;
    }
    reset(data);
    toast.success("Saved");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-2.5">
      <label className={cn(box, errors.full_name ? "bg-error-soft" : "bg-board")}>
        <span className={labelText}>Name</span>
        <input className={cn(control, "h-7")} autoComplete="name" {...register("full_name")} />
      </label>
      {errors.full_name && <p className="px-1 text-[13px] font-semibold text-error">{errors.full_name.message}</p>}

      <div className={cn(box, "bg-board")}>
        <span className={labelText}>Email</span>
        <span className="truncate text-base font-semibold text-slate">{email}</span>
      </div>

      <label id="phone" className={cn(box, errors.phone ? "bg-error-soft" : "bg-board")}>
        <span className={labelText}>Phone, for pick-up day</span>
        <input
          className={cn(control, "h-7")}
          type="tel"
          autoComplete="tel"
          placeholder="(206) 555-0100"
          {...register("phone")}
        />
      </label>
      {errors.phone && <p className="px-1 text-[13px] font-semibold text-error">{errors.phone.message}</p>}

      <label className={cn(box, "gap-1", errors.bio ? "bg-error-soft" : "bg-board")}>
        <span className={labelText}>A line for hosts</span>
        <textarea
          rows={2}
          className={cn(control, "resize-none font-normal")}
          placeholder="Ski weekends and the odd airport run."
          {...register("bio")}
        />
      </label>
      {errors.bio && <p className="px-1 text-[13px] font-semibold text-error">{errors.bio.message}</p>}

      <Button type="submit" className="mt-1 self-start" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
