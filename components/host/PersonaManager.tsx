"use client";

import { useRef, useState } from "react";
import { Camera, ChevronDown, ChevronUp, Pencil, Plus, Star, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Tile } from "@/components/kit";
import { formatDate, pluralize } from "@/lib/utils";

type Persona = {
  id: string;
  name: string;
  avatar_url: string | null;
  host_since: string | null;
  bio: string | null;
  trip_count: number;
  rating: number | null;
  rating_count: number;
};

type VehicleItem = { id: string; make: string; model: string; year: number; persona_id: string | null };

type FormValues = {
  name: string;
  host_since: string;
  bio: string;
  trip_count: string;
  rating: string;
  rating_count: string;
};

const EMPTY_FORM: FormValues = { name: "", host_since: "", bio: "", trip_count: "", rating: "", rating_count: "" };

function toForm(p: Persona): FormValues {
  return {
    name: p.name,
    host_since: p.host_since ?? "",
    bio: p.bio ?? "",
    trip_count: p.trip_count ? String(p.trip_count) : "",
    rating: p.rating != null ? String(p.rating) : "",
    rating_count: p.rating_count ? String(p.rating_count) : "",
  };
}

function Avatar({ url, name, size = "md" }: { url: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "size-20 rounded-[22px] text-[32px]" : size === "md" ? "size-16 rounded-[18px] text-[26px]" : "size-10 rounded-[12px] text-[16px]";
  if (url) {
    return <img src={url} alt={name} className={`${cls} shrink-0 object-cover`} />;
  }
  return (
    <span className={`${cls} flex shrink-0 items-center justify-center bg-mint font-display font-extrabold`}>
      {name[0]?.toUpperCase()}
    </span>
  );
}

function AvatarUpload({ current, onFile }: { current: string | null; name: string; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onFile(file);
  }
  const src = preview ?? current;
  return (
    <button type="button" onClick={() => ref.current?.click()} className="group relative shrink-0">
      {src ? (
        <img src={src} alt="" className="size-20 rounded-[22px] object-cover" />
      ) : (
        <span className="flex size-20 items-center justify-center rounded-[22px] bg-board text-slate">
          <Camera className="size-7" />
        </span>
      )}
      <span className="absolute inset-0 flex items-center justify-center rounded-[22px] bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
        <Camera className="size-6 text-white" />
      </span>
      <input ref={ref} type="file" accept="image/*" className="sr-only" onChange={pick} />
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-semibold text-slate">{children}</label>;
}

function Input({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="rounded-[10px] border border-line bg-board px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-ink"
    />
  );
}

function PersonaForm({ form, setForm, setAvatarFile, currentAvatar }: {
  form: FormValues;
  setForm: (f: FormValues) => void;
  avatarFile: File | null;
  setAvatarFile: (f: File | null) => void;
  currentAvatar: string | null;
}) {
  const set = (k: keyof FormValues) => (v: string) => setForm({ ...form, [k]: v });
  return (
    <div className="flex flex-wrap gap-4">
      <AvatarUpload current={currentAvatar} name={form.name || "?"} onFile={setAvatarFile} />
      <div className="flex flex-1 flex-col gap-3">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>Display name *</FieldLabel>
            <Input value={form.name} onChange={set("name")} placeholder="e.g. Sarah M." />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>Hosting since</FieldLabel>
            <Input type="date" value={form.host_since} onChange={set("host_since")} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <FieldLabel>Bio</FieldLabel>
          <textarea
            value={form.bio}
            onChange={(e) => set("bio")(e.target.value)}
            placeholder="Hi! I'm a car enthusiast based in Seattle…"
            rows={2}
            className="rounded-[10px] border border-line bg-board px-3 py-2 text-[15px] resize-none focus:outline-none focus:ring-2 focus:ring-ink"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <FieldLabel>Trips</FieldLabel>
            <Input type="number" value={form.trip_count} onChange={set("trip_count")} placeholder="0" />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>Rating (0–5)</FieldLabel>
            <Input type="number" value={form.rating} onChange={set("rating")} placeholder="4.9" />
          </div>
          <div className="flex flex-col gap-1">
            <FieldLabel>No. of ratings</FieldLabel>
            <Input type="number" value={form.rating_count} onChange={set("rating_count")} placeholder="0" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function PersonaManager({
  userId,
  initialPersonas,
  vehicles,
}: {
  userId: string;
  initialPersonas: Persona[];
  vehicles: VehicleItem[];
}) {
  const supabase = createClient();

  const [personas, setPersonas] = useState<Persona[]>(initialPersonas);
  const [assignments, setAssignments] = useState<Record<string, string | null>>(
    Object.fromEntries(vehicles.map((v) => [v.id, v.persona_id]))
  );
  const [creating, setCreating] = useState(false);
  const [newForm, setNewForm] = useState<FormValues>(EMPTY_FORM);
  const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormValues>(EMPTY_FORM);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function uploadAvatar(personaId: string, file: File): Promise<string | null> {
    const form = new FormData();
    form.append("file", file);
    form.append("personaId", personaId);
    const res = await fetch("/api/admin/upload-avatar", { method: "POST", body: form });
    const { url, error } = await res.json();
    if (error || !url) { toast.error("Photo upload failed — persona saved without it."); return null; }
    return url as string;
  }

  function parseForm(f: FormValues) {
    return {
      name: f.name.trim(),
      host_since: f.host_since || null,
      bio: f.bio.trim() || null,
      trip_count: parseInt(f.trip_count) || 0,
      rating: f.rating ? parseFloat(f.rating) : null,
      rating_count: parseInt(f.rating_count) || 0,
    };
  }

  async function createPersona() {
    const parsed = parseForm(newForm);
    if (!parsed.name) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("host_personas")
      .insert({ owner_id: userId, ...parsed })
      .select("id, name, avatar_url, host_since, bio, trip_count, rating, rating_count")
      .single();
    if (error || !data) { toast.error("Couldn't create persona."); setSaving(false); return; }
    let avatar_url = data.avatar_url;
    if (newAvatarFile) {
      avatar_url = await uploadAvatar(data.id, newAvatarFile);
      if (avatar_url) await supabase.from("host_personas").update({ avatar_url }).eq("id", data.id);
    }
    setPersonas((p) => [...p, { ...data, avatar_url }]);
    setNewForm(EMPTY_FORM); setNewAvatarFile(null); setCreating(false);
    toast.success("Persona created.");
    setSaving(false);
  }

  function startEdit(p: Persona) {
    setEditingId(p.id); setEditForm(toForm(p)); setEditAvatarFile(null); setDeletingId(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    const parsed = parseForm(editForm);
    if (!parsed.name) return;
    setSaving(true);
    // Only update avatar_url if a new file was picked AND upload succeeded.
    // A null result (failed upload) must NOT overwrite an existing avatar_url.
    const uploadedUrl = editAvatarFile ? await uploadAvatar(editingId, editAvatarFile) : undefined;
    const update = { ...parsed, ...(uploadedUrl ? { avatar_url: uploadedUrl } : {}) };
    const { error } = await supabase.from("host_personas").update(update).eq("id", editingId);
    if (error) { toast.error("Couldn't save."); setSaving(false); return; }
    setPersonas((p) => p.map((x) => x.id === editingId
      ? { ...x, ...parsed, ...(uploadedUrl ? { avatar_url: uploadedUrl } : {}) }
      : x
    ));
    setEditingId(null); setEditAvatarFile(null);
    toast.success("Saved.");
    setSaving(false);
  }

  async function deletePersona(id: string) {
    const { error } = await supabase.from("host_personas").delete().eq("id", id);
    if (error) { toast.error("Couldn't delete."); return; }
    setAssignments((a) => {
      const next = { ...a };
      for (const vid of Object.keys(next)) { if (next[vid] === id) next[vid] = null; }
      return next;
    });
    setPersonas((p) => p.filter((x) => x.id !== id));
    if (expandedId === id) setExpandedId(null);
    setDeletingId(null);
    toast.success("Deleted.");
  }

  async function toggleVehicle(vehicleId: string, personaId: string) {
    const current = assignments[vehicleId];
    const next = current === personaId ? null : personaId;
    setAssignments((a) => ({ ...a, [vehicleId]: next }));
    const { error } = await supabase.from("vehicles").update({ persona_id: next }).eq("id", vehicleId);
    if (error) { setAssignments((a) => ({ ...a, [vehicleId]: current })); toast.error("Couldn't update assignment."); }
  }

  const assignedTo = (personaId: string) => vehicles.filter((v) => assignments[v.id] === personaId);

  return (
    <div className="flex flex-col gap-3">
      {personas.map((persona) => {
        const isEditing = editingId === persona.id;
        const isExpanded = expandedId === persona.id;
        const isDeleting = deletingId === persona.id;
        const assigned = assignedTo(persona.id);

        return (
          <Tile key={persona.id} className="flex flex-col gap-3">
            {isEditing ? (
              <>
                <PersonaForm
                  form={editForm} setForm={setEditForm}
                  avatarFile={editAvatarFile} setAvatarFile={setEditAvatarFile}
                  currentAvatar={persona.avatar_url}
                />
                <div className="flex gap-2">
                  <Button onClick={saveEdit} disabled={!editForm.name.trim() || saving}>{saving ? "Saving…" : "Save"}</Button>
                  <Button variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </>
            ) : (
              <div className="flex flex-wrap items-start gap-4">
                <Avatar url={persona.avatar_url} name={persona.name} size="lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-display text-[20px] font-extrabold leading-tight">{persona.name}</span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate">
                    {persona.rating != null && (
                      <span className="flex items-center gap-1 font-semibold text-ink">
                        <Star className="size-3.5 fill-ink" strokeWidth={0} />
                        {persona.rating.toFixed(1)}
                        <span className="font-normal text-slate">({persona.rating_count})</span>
                      </span>
                    )}
                    {persona.trip_count > 0 && <span>{pluralize(persona.trip_count, "trip")}</span>}
                    {persona.host_since && <span>Hosting since {formatDate(persona.host_since, { day: undefined, month: "long" })}</span>}
                  </div>
                  {persona.bio && <p className="mt-0.5 text-[14px] text-slate line-clamp-2">{persona.bio}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {isDeleting ? (
                    <>
                      <span className="text-sm text-slate">Delete?</span>
                      <Button size="sm" variant="destructive" onClick={() => deletePersona(persona.id)}>Yes</Button>
                      <Button size="sm" variant="secondary" onClick={() => setDeletingId(null)}>No</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => startEdit(persona)}>
                        <Pencil className="size-3.5" /> Edit
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setDeletingId(persona.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Vehicle assignment toggle */}
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : persona.id)}
              className="flex items-center gap-2 text-[14px] text-slate hover:text-ink"
            >
              {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              {assigned.length === 0
                ? "No vehicles assigned"
                : `${assigned.length} vehicle${assigned.length !== 1 ? "s" : ""}: ${assigned.map((v) => `${v.year} ${v.make} ${v.model}`).join(", ")}`}
            </button>

            {isExpanded && (
              <div className="flex flex-col gap-1.5 rounded-[14px] bg-board p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate">Assign vehicles</p>
                {vehicles.map((v) => {
                  const checked = assignments[v.id] === persona.id;
                  const takenBy = assignments[v.id] && assignments[v.id] !== persona.id
                    ? personas.find((p) => p.id === assignments[v.id])?.name
                    : null;
                  return (
                    <label key={v.id} className="flex cursor-pointer items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-white/60">
                      <span className={`flex size-5 shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors ${checked ? "border-ink bg-ink" : "border-line bg-white"}`}>
                        {checked && <Check className="size-3 text-white" strokeWidth={3} />}
                      </span>
                      <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleVehicle(v.id, persona.id)} />
                      <span className="flex-1 text-[15px]">{v.year} {v.make} {v.model}</span>
                      {takenBy && <span className="text-xs text-slate">currently: {takenBy}</span>}
                    </label>
                  );
                })}
              </div>
            )}
          </Tile>
        );
      })}

      {/* New persona form */}
      {creating ? (
        <Tile className="flex flex-col gap-4">
          <PersonaForm
            form={newForm} setForm={setNewForm}
            avatarFile={newAvatarFile} setAvatarFile={setNewAvatarFile}
            currentAvatar={null}
          />
          <div className="flex gap-2">
            <Button onClick={createPersona} disabled={!newForm.name.trim() || saving}>{saving ? "Creating…" : "Create"}</Button>
            <Button variant="secondary" onClick={() => { setCreating(false); setNewForm(EMPTY_FORM); setNewAvatarFile(null); }}>
              <X className="size-4" />
            </Button>
          </div>
        </Tile>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-[18px] border-2 border-dashed border-line px-5 py-4 text-[15px] font-semibold text-slate hover:border-ink hover:text-ink"
        >
          <Plus className="size-5" /> New persona
        </button>
      )}
    </div>
  );
}
