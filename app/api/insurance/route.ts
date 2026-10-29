import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { INSURANCE_BUCKET, INSURANCE_LIMITS } from "@/lib/guest-checks";
import { toDateKey } from "@/lib/utils";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
  "application/pdf": "pdf",
};

/** Some phones send HEIC with no type, so fall back to the file name. */
const NAME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
};

const policy = z.object({
  insurer: z.string().trim().min(1).max(120),
  policy_number: z.string().trim().min(1).max(60),
  expires_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function fileType(file: File) {
  if (EXTENSIONS[file.type]) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return NAME_TYPES[ext] ?? null;
}

/**
 * Saves the guest's own auto insurance: insurer, policy number, the date it
 * ends and an optional photo of the card. Or `none`, when they don't have
 * any and every trip needs a protection plan.
 */
export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Log in to add your insurance.", 401);

  const form = await req.formData().catch(() => null);
  if (!form) return fail("Something's off with this form. Refresh and try again.", 400);

  const { data: existing } = await supabase.from("guest_insurance").select("card_path").eq("user_id", user.id).maybeSingle();
  const storage = supabase.storage.from(INSURANCE_BUCKET);
  const now = new Date().toISOString();

  if (form.get("none") === "1") {
    const { error } = await supabase.from("guest_insurance").upsert({
      user_id: user.id,
      has_none: true,
      insurer: null,
      policy_number: null,
      expires_on: null,
      card_path: null,
      updated_at: now,
    });
    if (error) return fail("Couldn't save that. Try again.", 500);
    if (existing?.card_path) await storage.remove([existing.card_path]);
    return NextResponse.json({ ok: true });
  }

  const parsed = policy.safeParse({
    insurer: form.get("insurer"),
    policy_number: form.get("policy_number"),
    expires_on: form.get("expires_on"),
  });
  if (!parsed.success) return fail("Add the insurer, the policy number and the date it ends.", 400);
  if (parsed.data.expires_on < toDateKey(new Date())) return fail("That policy has already ended. Add the current one.", 400);

  const file = form.get("card");
  let cardPath = form.get("keep_card") === "1" ? (existing?.card_path ?? null) : null;
  let uploaded: string | null = null;
  if (file instanceof File && file.size > 0) {
    const type = fileType(file);
    if (!type) return fail("The card has to be a photo (JPG, PNG, WebP, HEIC) or a PDF.", 400);
    if (file.size > INSURANCE_LIMITS.photoMaxBytes) return fail("The card has to be under 10 MB.", 400);
    uploaded = `${user.id}/${crypto.randomUUID()}.${EXTENSIONS[type]}`;
    const { error } = await storage.upload(uploaded, file, { contentType: type, upsert: false });
    if (error) return fail("Upload failed. Try again.", 500);
    cardPath = uploaded;
  }

  const { error } = await supabase.from("guest_insurance").upsert({
    user_id: user.id,
    has_none: false,
    ...parsed.data,
    card_path: cardPath,
    updated_at: now,
  });
  if (error) {
    if (uploaded) await storage.remove([uploaded]);
    return fail("Couldn't save your insurance. Try again.", 500);
  }
  if (existing?.card_path && existing.card_path !== cardPath) await storage.remove([existing.card_path]);

  return NextResponse.json({ ok: true });
}
