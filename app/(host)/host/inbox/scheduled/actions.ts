"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OFFSETS, syncHostMessages } from "@/lib/scheduled-messages";

type Result = { error?: string; id?: string };

const template = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Give it a name.").max(80),
  body: z.string().trim().min(1, "Write the message.").max(2000),
  event: z.enum(["booked", "trip_start", "three_quarters", "trip_end"]),
  offset_minutes: z.number().int().refine((n) => OFFSETS.includes(n)),
  direction: z.enum(["before", "after"]),
  trip_type: z.enum(["all", "any_delivery", "no_delivery", "custom_delivery", "airport_delivery"]),
  vehicle_ids: z.array(z.string().uuid()).min(1, "Pick at least one car.").nullable(),
  active: z.boolean(),
});

export type TemplateInput = z.input<typeof template>;

async function host() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Queues the template on trips already booked, then refreshes the pages. */
async function resync(hostId: string) {
  await syncHostMessages(hostId);
  revalidatePath("/host/inbox/scheduled", "layout");
}

export async function saveTemplate(input: TemplateInput): Promise<Result> {
  const { supabase, user } = await host();
  if (!user) return { error: "Log in again." };
  const parsed = template.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const { id, ...fields } = parsed.data;
  // A booking has no "before".
  if (fields.event === "booked") fields.direction = "after";

  // RLS keeps hosts to their own templates.
  const { data, error } = id
    ? await supabase
        .from("message_templates")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("host_id", user.id)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("message_templates")
        .insert({ ...fields, host_id: user.id })
        .select("id")
        .single();
  if (error || !data) return { error: "Not saved. Try again." };

  await resync(user.id);
  return { id: data.id };
}

export async function setTemplateActive(id: string, active: boolean): Promise<Result> {
  const { supabase, user } = await host();
  if (!user) return { error: "Log in again." };
  const { data } = await supabase
    .from("message_templates")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("host_id", user.id)
    .select("id");
  if (!data?.length) return { error: "Not saved. Try again." };
  await resync(user.id);
  return {};
}

export async function deleteTemplate(id: string): Promise<Result> {
  const { supabase, user } = await host();
  if (!user) return { error: "Log in again." };
  // Messages already sent stay in the history; ones still waiting are dropped.
  await createAdminClient()
    .from("scheduled_messages")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("template_id", id)
    .eq("host_id", user.id)
    .eq("status", "scheduled");
  const { data } = await supabase.from("message_templates").delete().eq("id", id).eq("host_id", user.id).select("id");
  if (!data?.length) return { error: "Couldn't delete it. Try again." };
  revalidatePath("/host/inbox/scheduled", "layout");
  return {};
}

/** Skip one trip's message, or put a skipped one back while there's still time. */
export async function setScheduledStatus(id: string, status: "scheduled" | "skipped"): Promise<Result> {
  const { user } = await host();
  if (!user) return { error: "Log in again." };
  const admin = createAdminClient();
  let query = admin
    .from("scheduled_messages")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("host_id", user.id)
    .eq("status", status === "skipped" ? "scheduled" : "skipped");
  if (status === "scheduled") query = query.gt("send_at", new Date().toISOString());
  const { data } = await query.select("id");
  if (!data?.length) {
    return { error: status === "skipped" ? "It's already gone out." : "It's too late to send this one." };
  }
  revalidatePath("/host/inbox/scheduled/upcoming");
  return {};
}
