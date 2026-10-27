"use client";

import { useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { GuestInstructions } from "@/lib/supabase/types";
import { CHECK_IN, type CheckInMethod, type Faq, LIMITS } from "@/lib/guest-instructions";
import { cn, formatDate } from "@/lib/utils";
import { Tag } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Draft = {
  check_in_method: CheckInMethod;
  pickup_instructions: string;
  welcome_message: string;
  car_guide: string;
  faqs: Faq[];
};

/** Questions guests ask most. A tap adds the question; the host writes the answer. */
const COMMON_QUESTIONS = [
  "How do tolls work?",
  "Can I bring my pet?",
  "Where should I fill up or charge?",
  "Can I return it early?",
];

function toDraft(row: GuestInstructions | null): Draft {
  return {
    check_in_method: row?.check_in_method ?? "in_person",
    pickup_instructions: row?.pickup_instructions ?? "",
    welcome_message: row?.welcome_message ?? "",
    car_guide: row?.car_guide ?? "",
    faqs: row?.faqs ?? [],
  };
}

function Count({ value, max }: { value: string; max: number }) {
  return (
    <span className={cn("figures text-[13px] font-semibold", value.length > max ? "text-error" : "text-slate")}>
      {value.length.toLocaleString()} / {max.toLocaleString()}
    </span>
  );
}

function Field({
  id,
  label,
  help,
  value,
  max,
  onChange,
  placeholder,
  className,
}: {
  id: string;
  label: string;
  help: string;
  value: string;
  max: number;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-lg font-extrabold">
        {label}
      </Label>
      <p className="text-[15px] text-slate">{help}</p>
      <Textarea
        id={id}
        value={value}
        maxLength={max}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("mt-1", className)}
      />
      <span className="self-end">
        <Count value={value} max={max} />
      </span>
    </div>
  );
}

/** Pick-up notes, welcome message, car guide and FAQs that booked guests see. */
export function GuestInstructionsForm({ vehicleId, initial }: { vehicleId: string; initial: GuestInstructions | null }) {
  const [saved, setSaved] = useState(() => toDraft(initial));
  const [draft, setDraft] = useState(saved);
  const [updatedAt, setUpdatedAt] = useState(initial?.updated_at ?? null);
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setFaq = (i: number, patch: Partial<Faq>) =>
    set(
      "faqs",
      draft.faqs.map((f, j) => (j === i ? { ...f, ...patch } : f))
    );
  const asked = new Set(draft.faqs.map((f) => f.question.trim().toLowerCase()));
  const suggestions = COMMON_QUESTIONS.filter((q) => !asked.has(q.toLowerCase()));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const faqs = draft.faqs
      .map((f) => ({ question: f.question.trim(), answer: f.answer.trim() }))
      .filter((f) => f.question || f.answer);
    if (faqs.some((f) => !f.question || !f.answer)) return toast.error("Each question needs an answer, and each answer a question.");

    setSaving(true);
    const { data, error } = await createClient()
      .from("vehicle_guest_instructions")
      .upsert(
        {
          vehicle_id: vehicleId,
          check_in_method: draft.check_in_method,
          pickup_instructions: draft.pickup_instructions.trim() || null,
          welcome_message: draft.welcome_message.trim() || null,
          car_guide: draft.car_guide.trim() || null,
          faqs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "vehicle_id" }
      )
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) {
      toast.error("Couldn't save that. Try again.");
      return;
    }
    const next = toDraft(data);
    setSaved(next);
    setDraft(next);
    setUpdatedAt(data.updated_at);
    toast.success("Saved. Guests with a booked trip see the new version.");
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-[26px]">Guest instructions</h2>
          <p className="flex items-center gap-1.5 text-[15px] text-slate">
            <Lock className="size-4 shrink-0" strokeWidth={1.75} />
            Only guests with a booked trip see these.
          </p>
        </div>
        {dirty ? (
          <Tag tone="butter">Not saved yet</Tag>
        ) : updatedAt ? (
          <Tag tone="board">Saved {formatDate(updatedAt, { year: undefined })}</Tag>
        ) : null}
      </div>

      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-lg font-extrabold">Getting the keys</span>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Getting the keys">
              {(Object.keys(CHECK_IN) as CheckInMethod[]).map((m) => {
                const on = draft.check_in_method === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set("check_in_method", m)}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-[16px] px-3.5 py-3 text-left transition-colors",
                      on ? "bg-ink text-white" : "bg-board text-ink hover:bg-line"
                    )}
                  >
                    <span className="text-[15px] font-extrabold">{CHECK_IN[m].label}</span>
                    <span className={cn("text-[13px] leading-snug", on ? "text-white/75" : "text-slate")}>{CHECK_IN[m].hint}</span>
                  </button>
                );
              })}
            </div>
            <p className="rounded-[14px] bg-sky px-3 py-2.5 text-[15px] text-sky-ink">
              <span className="font-extrabold">Guests see:</span> {CHECK_IN[draft.check_in_method].guestLine}
            </p>
          </div>

          <Field
            id="gi-pickup"
            label="Pick-up and return"
            help="Where to find the car and how to get the keys. Shown on every trip except deliveries, since you bring the car to those."
            value={draft.pickup_instructions}
            max={LIMITS.pickup}
            onChange={(v) => set("pickup_instructions", v)}
            placeholder="Parked on level 2 of the garage, spot 214. The lockbox is on the driver's door handle, code 4821. Bring it back to the same spot."
            className="min-h-40"
          />

          <Field
            id="gi-welcome"
            label="Welcome message"
            help="A short hello guests see when they check in. A nice touch if you don't meet them in person."
            value={draft.welcome_message}
            max={LIMITS.welcome}
            onChange={(v) => set("welcome_message", v)}
            placeholder="Thanks for booking! Text me if anything comes up. Have a great trip."
            className="min-h-20"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Field
            id="gi-guide"
            label="Car guide"
            help="Quirks and tips for driving it, like how to start a hybrid or where the fuel door release is."
            value={draft.car_guide}
            max={LIMITS.guide}
            onChange={(v) => set("car_guide", v)}
            placeholder="Press the brake and the power button. It's silent when it starts, so look for READY on the dash."
            className="min-h-40"
          />

          <div className="flex flex-col gap-2">
            <span className="text-lg font-extrabold">Questions guests ask</span>
            <p className="text-[15px] text-slate">Answer them once here instead of in messages on every trip.</p>
            {draft.faqs.map((f, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-[18px] bg-board p-3">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Question ${i + 1}`}
                    value={f.question}
                    maxLength={LIMITS.question}
                    onChange={(e) => setFaq(i, { question: e.target.value })}
                    placeholder="Question"
                    className="bg-white font-bold"
                  />
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    aria-label={`Remove question ${i + 1}`}
                    onClick={() =>
                      set(
                        "faqs",
                        draft.faqs.filter((_, j) => j !== i)
                      )
                    }
                    className="shrink-0 text-error"
                  >
                    <Trash2 />
                  </Button>
                </div>
                <Textarea
                  aria-label={`Answer ${i + 1}`}
                  value={f.answer}
                  maxLength={LIMITS.answer}
                  onChange={(e) => setFaq(i, { answer: e.target.value })}
                  placeholder="Answer"
                  className="min-h-16 bg-white"
                />
              </div>
            ))}
            {draft.faqs.length === 0 && (
              <p className="rounded-[18px] bg-board p-3.5 text-[15px] text-slate">No questions yet.</p>
            )}
            {draft.faqs.length < LIMITS.faqs && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => set("faqs", [...draft.faqs, { question: "", answer: "" }])}
                >
                  <Plus />
                  Add a question
                </Button>
                {suggestions.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => set("faqs", [...draft.faqs, { question: q, answer: "" }])}
                    className="flex items-center gap-1.5 rounded-[12px] bg-board px-3 py-2 text-sm font-bold transition-colors hover:bg-line"
                  >
                    <Plus className="size-3.5" />
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {dirty && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t-2 border-ink/10 pt-4">
          <Button type="button" variant="secondary" disabled={saving} onClick={() => setDraft(saved)}>
            Undo changes
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      )}
    </form>
  );
}
