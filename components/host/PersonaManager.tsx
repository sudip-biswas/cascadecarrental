"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X, Check } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Tile } from "@/components/kit";
import { formatDate } from "@/lib/utils";

type Persona = { id: string; name: string; host_since: string | null };
type VehicleItem = { id: string; make: string; model: string; year: number; persona_id: string | null };

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
  // vehicle id → persona_id (null = unassigned)
  const [assignments, setAssignments] = useState<Record<string, string | null>>(
    Object.fromEntries(vehicles.map((v) => [v.id, v.persona_id]))
  );

  // create form
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSince, setNewSince] = useState("");

  // edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSince, setEditSince] = useState("");

  // delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // expanded vehicle assignment panel
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function createPersona() {
    const name = newName.trim();
    if (!name) return;
    const { data, error } = await supabase
      .from("host_personas")
      .insert({ owner_id: userId, name, host_since: newSince || null })
      .select("id, name, host_since")
      .single();
    if (error || !data) { toast.error("Couldn't create persona."); return; }
    setPersonas((p) => [...p, data]);
    setNewName(""); setNewSince(""); setCreating(false);
    toast.success("Persona created.");
  }

  function startEdit(p: Persona) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditSince(p.host_since ?? "");
    setDeletingId(null);
  }

  async function saveEdit() {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) return;
    const { error } = await supabase
      .from("host_personas")
      .update({ name, host_since: editSince || null })
      .eq("id", editingId);
    if (error) { toast.error("Couldn't save."); return; }
    setPersonas((p) => p.map((x) => x.id === editingId ? { ...x, name, host_since: editSince || null } : x));
    setEditingId(null);
    toast.success("Saved.");
  }

  async function deletePersona(id: string) {
    const { error } = await supabase.from("host_personas").delete().eq("id", id);
    if (error) { toast.error("Couldn't delete."); return; }
    // clear assignments for vehicles that had this persona
    setAssignments((a) => {
      const next = { ...a };
      for (const vid of Object.keys(next)) { if (next[vid] === id) next[vid] = null; }
      return next;
    });
    setPersonas((p) => p.filter((x) => x.id !== id));
    if (expandedId === id) setExpandedId(null);
    setDeletingId(null);
    toast.success("Persona deleted.");
  }

  async function toggleVehicle(vehicleId: string, personaId: string) {
    const current = assignments[vehicleId];
    const next = current === personaId ? null : personaId;
    setAssignments((a) => ({ ...a, [vehicleId]: next }));
    const { error } = await supabase
      .from("vehicles")
      .update({ persona_id: next })
      .eq("id", vehicleId);
    if (error) {
      setAssignments((a) => ({ ...a, [vehicleId]: current }));
      toast.error("Couldn't update assignment.");
    }
  }

  const assignedTo = (personaId: string) =>
    vehicles.filter((v) => assignments[v.id] === personaId);

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
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate">Display name</label>
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                    className="rounded-[10px] border border-line bg-board px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate">Hosting since (optional)</label>
                  <input
                    type="date"
                    value={editSince}
                    onChange={(e) => setEditSince(e.target.value)}
                    className="rounded-[10px] border border-line bg-board px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>
                <div className="flex gap-2 pb-0.5">
                  <Button size="sm" onClick={saveEdit}>Save</Button>
                  <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-display text-[20px] font-extrabold">{persona.name}</span>
                  {persona.host_since && (
                    <span className="text-sm text-slate">
                      Hosting since {formatDate(persona.host_since, { day: undefined, month: "long" })}
                    </span>
                  )}
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

            {/* Assigned vehicles summary + toggle */}
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
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => toggleVehicle(v.id, persona.id)}
                      />
                      <span className="flex-1 text-[15px]">
                        {v.year} {v.make} {v.model}
                      </span>
                      {takenBy && (
                        <span className="text-xs text-slate">currently: {takenBy}</span>
                      )}
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
        <Tile className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate">Display name</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createPersona()}
              placeholder="e.g. Sarah M."
              className="rounded-[10px] border border-line bg-board px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-ink"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate">Hosting since (optional)</label>
            <input
              type="date"
              value={newSince}
              onChange={(e) => setNewSince(e.target.value)}
              className="rounded-[10px] border border-line bg-board px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-ink"
            />
          </div>
          <div className="flex gap-2 pb-0.5">
            <Button onClick={createPersona} disabled={!newName.trim()}>Create</Button>
            <Button variant="secondary" onClick={() => { setCreating(false); setNewName(""); setNewSince(""); }}>
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
