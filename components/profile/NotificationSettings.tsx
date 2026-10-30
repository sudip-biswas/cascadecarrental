"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { NotificationPreferences } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export type Choices = Pick<NotificationPreferences, "messages_email" | "recommendations_email" | "offers_email" | "news_email">;

const OPTIONAL: { key: keyof Choices; title: string; about: string }[] = [
  { key: "messages_email", title: "Host & guest messages", about: "When your host or guest sends you a message about a trip." },
  { key: "recommendations_email", title: "Personalized recommendations", about: "Suggestions for trips and cars you might enjoy." },
  { key: "offers_email", title: "Offers", about: "Discounts, limited-time offers and seasonal promotions." },
  { key: "news_email", title: "News & updates", about: "New features and improvements to Cascade." },
];

function Choice({
  id,
  label,
  note,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  note?: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 text-[15px] font-semibold has-disabled:text-slate">
      <Checkbox id={id} className="mt-0.5 size-5 border-slate data-checked:border-primary" checked={checked} disabled={disabled} onCheckedChange={(c) => onChange?.(c === true)} />
      <span>
        {label}
        {note && <span className="block text-[13px] font-normal text-slate">{note}</span>}
      </span>
    </label>
  );
}

function Group({ title, about, children }: { title: string; about: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="contents">
        <span className="block text-[13px] font-bold tracking-wide uppercase">{title}</span>
      </legend>
      <p className="text-[15px] text-slate">{about}</p>
      {children}
    </fieldset>
  );
}

/** Which emails someone gets. SMS shows as coming soon until Cascade can send texts. */
export function NotificationSettings({ userId, initial }: { userId: string; initial: Choices }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [choices, setChoices] = useState(initial);
  const [saving, setSaving] = useState(false);
  const changed = OPTIONAL.some(({ key }) => choices[key] !== saved[key]);

  async function save() {
    setSaving(true);
    const { error } = await createClient()
      .from("notification_preferences")
      .upsert({ user_id: userId, ...choices, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) return toast.error("Couldn't save that. Try again.");
    setSaved(choices);
    toast.success("Notification settings saved.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1.5">
        <span className="text-[14px] font-semibold">Language</span>
        <select className="rounded-[14px] bg-board px-3.5 py-3 text-base font-bold text-ink outline-none focus:ring-2 focus:ring-ink">
          <option>English (United States)</option>
        </select>
      </label>

      <Group title="Trip & account" about="Updates about your trips, bookings and account activity.">
        <Choice id="notify-trip-email" label="Email" note="Required" checked disabled />
        <Choice id="notify-trip-sms" label="SMS" note="Coming soon" checked={false} disabled />
      </Group>

      {OPTIONAL.map(({ key, title, about }) => (
        <Group key={key} title={title} about={about}>
          <Choice
            id={`notify-${key}`}
            label="Email"
            checked={choices[key]}
            onChange={(checked) => setChoices((c) => ({ ...c, [key]: checked }))}
          />
          <Choice id={`notify-${key}-sms`} label="SMS" note="Coming soon" checked={false} disabled />
        </Group>
      ))}

      <Button className="self-start" disabled={!changed || saving} onClick={save}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
