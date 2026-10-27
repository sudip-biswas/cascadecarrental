"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MessageTemplate } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Tile, TileTitle } from "@/components/kit";
import { BoxInput, BoxSelect, BoxTextarea, FieldBox, Toggle } from "@/components/listing-wizard/controls";
import {
  describeSchedule,
  EVENTS,
  EXAMPLES,
  formatOffset,
  OFFSETS,
  previewMessage,
  TRIP_TYPES,
  VARIABLES,
} from "./options";
import { deleteTemplate, saveTemplate, type TemplateInput } from "@/app/(host)/host/inbox/scheduled/actions";

export interface CarOption {
  id: string;
  label: string;
}

type Draft = Omit<TemplateInput, "id">;

const BLANK: Draft = {
  name: "",
  body: "",
  event: "booked",
  offset_minutes: 0,
  direction: "after",
  trip_type: "all",
  vehicle_ids: null,
  active: true,
};

/** Create or edit a template: name, when it goes out, which trips and cars, and the message. */
export function TemplateForm({ template, cars }: { template?: MessageTemplate; cars: CarOption[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(
    template
      ? {
          name: template.name,
          body: template.body,
          event: template.event,
          offset_minutes: template.offset_minutes,
          direction: template.direction,
          trip_type: template.trip_type,
          vehicle_ids: template.vehicle_ids,
          active: template.active,
        }
      : BLANK
  );
  const [error, setError] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState(false);
  const [mention, setMention] = useState<{ query: string; at: number } | null>(null);
  const [saving, startSave] = useTransition();
  const [deleting, startDelete] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);

  const set = (update: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...update }));
    setError(null);
  };
  const booked = draft.event === "booked";
  const allCars = draft.vehicle_ids === null;
  const picked = new Set(draft.vehicle_ids ?? []);

  /** Opens the @ menu while the word under the cursor starts with @. */
  function track(el: HTMLTextAreaElement) {
    const before = el.value.slice(0, el.selectionStart);
    const match = /@([A-Za-z]*)$/.exec(before);
    setMention(match ? { query: match[1].toLowerCase(), at: before.length - match[0].length } : null);
  }

  function insert(token: string) {
    const el = box.current;
    const body = draft.body;
    const start = mention ? mention.at : (el?.selectionStart ?? body.length);
    const end = el?.selectionEnd ?? body.length;
    const text = `@${token} `;
    set({ body: body.slice(0, start) + text + body.slice(end) });
    setMention(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  }

  const matches = mention
    ? VARIABLES.filter(
        (v) => v.token.toLowerCase().startsWith(mention.query) || v.label.toLowerCase().includes(mention.query)
      )
    : [];

  function toggleCar(id: string) {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ vehicle_ids: [...next] });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return setError("Give it a name.");
    if (!draft.body.trim()) return setError("Write the message.");
    if (draft.vehicle_ids && draft.vehicle_ids.length === 0) return setError("Pick at least one car.");
    startSave(async () => {
      const result = await saveTemplate({ ...draft, id: template?.id });
      if (result.error) {
        setError(result.error);
        return;
      }
      toast.success(template ? "Template saved." : "Template created. Trips already booked get it too.");
      router.push("/host/inbox/scheduled");
    });
  }

  function remove() {
    if (!template || !confirm(`Delete "${template.name}"? Messages waiting to go out from it are dropped.`)) return;
    startDelete(async () => {
      const result = await deleteTemplate(template.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Template deleted.");
      router.push("/host/inbox/scheduled");
    });
  }

  return (
    <form onSubmit={submit} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-4">
        <Tile className="flex flex-col gap-3 sm:p-6">
          <TileTitle>Name</TileTitle>
          <FieldBox label="Only you see this. Guests never do.">
            <BoxInput
              value={draft.name}
              maxLength={80}
              placeholder="Airport delivery: end of trip reminder"
              onChange={(e) => set({ name: e.target.value })}
            />
          </FieldBox>
        </Tile>

        <Tile className="flex flex-col gap-3 sm:p-6">
          <TileTitle>When it goes out</TileTitle>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <FieldBox label="Time">
              <BoxSelect
                value={draft.offset_minutes}
                onChange={(e) => set({ offset_minutes: Number(e.target.value) })}
              >
                {OFFSETS.map((m) => (
                  <option key={m} value={m}>
                    {formatOffset(m)}
                  </option>
                ))}
              </BoxSelect>
            </FieldBox>
            <FieldBox label="Before or after">
              <BoxSelect
                value={booked ? "after" : draft.direction}
                disabled={booked}
                onChange={(e) => set({ direction: e.target.value as Draft["direction"] })}
              >
                <option value="after">After</option>
                <option value="before">Before</option>
              </BoxSelect>
            </FieldBox>
            <FieldBox label="Trip moment">
              <BoxSelect
                value={draft.event}
                onChange={(e) => {
                  const event = e.target.value as Draft["event"];
                  set(event === "booked" ? { event, direction: "after" } : { event });
                }}
              >
                {EVENTS.map((ev) => (
                  <option key={ev.value} value={ev.value}>
                    {ev.label}
                  </option>
                ))}
              </BoxSelect>
            </FieldBox>
          </div>
          <p className="px-1 text-[15px] font-semibold">{describeSchedule({ ...draft, direction: booked ? "after" : draft.direction })}</p>
          <p className="px-1 text-sm text-slate">
            3/4 time is three quarters of the way through the trip, a good moment for return instructions.
          </p>
        </Tile>

        <Tile className="flex flex-col gap-3 sm:p-6">
          <TileTitle>Which trips</TileTitle>
          <FieldBox label="Trip type">
            <BoxSelect value={draft.trip_type} onChange={(e) => set({ trip_type: e.target.value as Draft["trip_type"] })}>
              {TRIP_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </BoxSelect>
          </FieldBox>
          <div className="rounded-[18px] bg-board p-1.5">
            <Toggle
              label="All my cars"
              hint={allCars ? "Including cars you list later" : `${picked.size} of ${cars.length} picked`}
              checked={allCars}
              onChange={(on) => set({ vehicle_ids: on ? null : cars.map((c) => c.id) })}
            />
            {!allCars && (
              <div className="flex flex-wrap gap-1.5 p-2">
                {cars.map((car) => {
                  const on = picked.has(car.id);
                  return (
                    <button
                      key={car.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleCar(car.id)}
                      className={cn(
                        "flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-sm font-bold transition-colors",
                        on ? "bg-ink text-white" : "bg-white hover:bg-line"
                      )}
                    >
                      {on && <Check className="size-3.5" strokeWidth={3} />}
                      {car.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Tile>

        <Tile className="flex flex-col gap-3 sm:p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <TileTitle>Message</TileTitle>
            <button
              type="button"
              onClick={() => setShowExamples((s) => !s)}
              className="text-[15px] font-bold text-cobalt hover:underline"
            >
              {showExamples ? "Hide examples" : "See examples"}
            </button>
          </div>
          <p className="text-[15px] text-slate">
            Type @ to add trip details like the guest&apos;s name or pick-up time. They&apos;re filled in for each trip.
            Keep it short and friendly.
          </p>

          {showExamples && (
            <ul className="flex flex-col gap-2">
              {EXAMPLES.map((ex) => (
                <li key={ex.name} className="flex flex-col gap-2 rounded-[18px] bg-sky p-3.5 text-ink">
                  <span className="text-[15px] font-extrabold">{ex.name}</span>
                  <span className="text-[15px]">{ex.body}</span>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="self-start"
                    onClick={() => {
                      set({ body: ex.body, name: draft.name || ex.name });
                      setShowExamples(false);
                    }}
                  >
                    Use this
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="relative">
            <FieldBox label="What the guest gets">
              <BoxTextarea
                ref={box}
                value={draft.body}
                maxLength={2000}
                rows={6}
                className="min-h-36"
                placeholder="Hi @GuestName, thanks for booking my @CarName!"
                onChange={(e) => {
                  set({ body: e.target.value });
                  track(e.target);
                }}
                onKeyUp={(e) => track(e.currentTarget)}
                onClick={(e) => track(e.currentTarget)}
                onBlur={() => setTimeout(() => setMention(null), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setMention(null);
                  if (e.key === "Enter" && matches.length) {
                    e.preventDefault();
                    insert(matches[0].token);
                  }
                }}
              />
            </FieldBox>
            {matches.length > 0 && (
              <ul
                role="listbox"
                aria-label="Trip details"
                className="absolute inset-x-2 top-full z-10 mt-1 flex max-h-64 flex-col overflow-y-auto rounded-[16px] bg-white p-1.5 shadow-[0_12px_32px_rgba(20,22,28,0.16)]"
              >
                {matches.map((v) => (
                  <li key={v.token}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insert(v.token)}
                      className="flex w-full items-baseline justify-between gap-3 rounded-[10px] px-3 py-2 text-left hover:bg-board"
                    >
                      <span className="text-[15px] font-bold">@{v.token}</span>
                      <span className="text-sm text-slate">{v.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map((v) => (
              <button
                key={v.token}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(v.token)}
                className="h-8 rounded-[9px] bg-board px-2.5 text-[13px] font-bold transition-colors hover:bg-line"
              >
                {v.label}
              </button>
            ))}
          </div>
        </Tile>
      </div>

      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        <Tile tone="butter" className="flex flex-col gap-3 sm:p-6">
          <TileTitle>Preview</TileTitle>
          <p className="text-sm">With a made-up trip, as the guest sees it in their inbox.</p>
          <p className="rounded-[18px] rounded-bl-[6px] bg-white p-3.5 text-[15px] whitespace-pre-wrap text-ink">
            {draft.body.trim() ? previewMessage(draft.body) : "Your message shows here."}
          </p>
        </Tile>
        <Tile className="flex flex-col gap-3 sm:p-6">
          <div className="rounded-[18px] bg-board p-1.5">
            <Toggle
              label="On"
              hint={draft.active ? "Goes out on every matching trip" : "Saved, but nothing goes out"}
              checked={draft.active}
              onChange={(active) => set({ active })}
            />
          </div>
          {error && (
            <p role="alert" className="rounded-[14px] bg-error-soft px-3.5 py-3 text-[15px] font-semibold text-error">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={saving || deleting}>
            {saving ? "Saving…" : template ? "Save template" : "Create template"}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/host/inbox/scheduled">Cancel</Link>
          </Button>
          {template && (
            <Button type="button" variant="destructive" onClick={remove} disabled={saving || deleting}>
              {deleting ? "Deleting…" : "Delete template"}
            </Button>
          )}
        </Tile>
      </div>
    </form>
  );
}
