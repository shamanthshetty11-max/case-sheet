import { supabase } from "@/integrations/supabase/client";
import { db, hasLocalDb, newId, nowIso, type Row } from "./local-db";
import { localDelete, localGet, localList, localPatch, localUpsert, queueFileUpload } from "./sync";

export type Procedure = {
  id: string;
  user_id: string;
  performed_at: string;
  name: string;
  category: string | null;
  patient_ref: string | null;
  indication: string | null;
  site: string | null;
  surgeon: string | null;
  assistant_surgeon: string | null;
  role: "observed" | "assisted" | "performed" | "supervised" | null;
  difficulty: number | null;
  outcome: string | null;
  complications: string | null;
  lessons: string | null;
  notes: string | null;
  total_duration_seconds: number | null;
  pa_names: string[] | null;
  status: string | null;
  scrub_in_at: string | null;
  scrub_out_at: string | null;
  patient_name: string | null;
  ip_number: string | null;
  closed_by: string | null;
  preset_values: Record<string, string> | null;
  preset_id: string | null;
  patient_height_cm: number | null;
  patient_weight_kg: number | null;
  created_at: string;
  updated_at: string;
};

export type ProcedureStep = {
  id: string;
  procedure_id: string;
  user_id: string;
  label: string;
  duration_seconds: number;
  order_idx: number;
  notes: string | null;
};

export type Attachment = {
  id: string;
  procedure_id: string;
  user_id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export const PROCEDURE_CATEGORIES = [
  "Cardiac surgery", "Airway", "Vascular access", "Suturing", "Incision & drainage",
  "Lumbar puncture", "Splinting/Casting", "Joint injection",
  "Skin biopsy", "Ultrasound", "Endoscopy", "Other",
];

export const ROLES: Procedure["role"][] = ["observed", "assisted", "performed", "supervised"];

export const NOTES_TEMPLATE = `HbA1c - \nEF -  %\nLMCA - `;

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

function byOrder<T extends { sort_order?: number; created_at?: string }>(a: T, b: T) {
  const sa = a.sort_order ?? 0;
  const sb = b.sort_order ?? 0;
  if (sa !== sb) return sa - sb;
  return (a.created_at ?? "").localeCompare(b.created_at ?? "");
}

// -------- Team --------
export type TeamMember = { id: string; name: string; created_at: string; sort_order?: number };

export async function listTeamSurgeons(): Promise<TeamMember[]> {
  return (await localList<TeamMember>("team_surgeons")).sort(byOrder);
}
export async function listTeamPAs(): Promise<TeamMember[]> {
  return (await localList<TeamMember>("team_pas")).sort(byOrder);
}
async function addTeamMember(table: "team_surgeons" | "team_pas", name: string): Promise<TeamMember> {
  const user_id = await requireUserId();
  const existing = await localList<TeamMember>(table);
  const row = await localUpsert(table, {
    id: newId(), user_id, name,
    sort_order: existing.length,
    created_at: nowIso(),
  });
  return row as unknown as TeamMember;
}
export async function addTeamSurgeon(name: string) {
  return addTeamMember("team_surgeons", name);
}
export async function addTeamPA(name: string) {
  return addTeamMember("team_pas", name);
}
export async function deleteTeamSurgeon(id: string) {
  await localDelete("team_surgeons", id);
}
export async function deleteTeamPA(id: string) {
  await localDelete("team_pas", id);
}

export async function reorderTeam(table: "team_surgeons" | "team_pas", ids: string[]) {
  for (const [idx, id] of ids.entries()) {
    await localPatch(table, id, { sort_order: idx });
  }
}

// -------- Surgical approaches --------
export type SurgicalApproach = { id: string; name: string; sort_order: number; created_at: string };

export async function listSurgicalApproaches(): Promise<SurgicalApproach[]> {
  return (await localList<SurgicalApproach>("surgical_approaches")).sort(byOrder);
}
export async function addSurgicalApproach(name: string): Promise<SurgicalApproach> {
  const user_id = await requireUserId();
  const existing = await localList<SurgicalApproach>("surgical_approaches");
  const row = await localUpsert("surgical_approaches", {
    id: newId(), user_id, name, sort_order: existing.length, created_at: nowIso(),
  });
  return row as unknown as SurgicalApproach;
}
export async function deleteSurgicalApproach(id: string) {
  await localDelete("surgical_approaches", id);
}

// -------- Re-explorations --------
export type Reexploration = {
  id: string;
  procedure_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  reason: string | null;
  notes: string | null;
  created_at: string;
};

export async function getActiveReexploration(): Promise<Reexploration | null> {
  const all = await localList<Reexploration>("procedure_reexplorations");
  const open = all.filter((r) => !r.ended_at).sort((a, b) => b.started_at.localeCompare(a.started_at));
  return open[0] ?? null;
}

export async function startReexploration(procedure_id: string): Promise<Reexploration> {
  const user_id = await requireUserId();
  const row = await localUpsert("procedure_reexplorations", {
    id: newId(), procedure_id, user_id,
    started_at: nowIso(), ended_at: null, duration_seconds: null,
    reason: null, notes: null, created_at: nowIso(),
  });
  return row as unknown as Reexploration;
}

export async function endReexploration(id: string, reason: string, notes: string): Promise<Reexploration> {
  const existing = await localGet<Reexploration>("procedure_reexplorations", id);
  if (!existing) throw new Error("Re-exploration not found");
  const now = new Date();
  const startedAt = existing.started_at ? new Date(existing.started_at) : now;
  const duration = Math.max(0, Math.round((now.getTime() - startedAt.getTime()) / 1000));
  const row = await localPatch("procedure_reexplorations", id, {
    ended_at: now.toISOString(),
    duration_seconds: duration,
    reason: reason || null,
    notes: notes || null,
  });

  // Append a summary to the parent case notes.
  const proc = await localGet<Procedure>("procedures", existing.procedure_id);
  if (proc) {
    const stamp = now.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    const block = `\n\n--- Re-exploration ${stamp} (${formatDuration(duration)}) ---${reason ? `\nReason: ${reason}` : ""}${notes ? `\nNotes: ${notes}` : ""}`;
    await localPatch("procedures", existing.procedure_id, { notes: (proc.notes ?? "") + block });
  }

  return row as unknown as Reexploration;
}

export async function listReexplorations(procedureId: string): Promise<Reexploration[]> {
  const all = await localList<Reexploration>("procedure_reexplorations");
  return all
    .filter((r) => r.procedure_id === procedureId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at));
}

// -------- Procedure name catalog --------
export type ProcedureName = {
  id: string;
  category: string;
  name: string;
  sort_order: number;
  preset_id: string | null;
  created_at: string;
};

export async function listProcedureNames(): Promise<ProcedureName[]> {
  const all = await localList<ProcedureName>("procedure_names");
  return all.sort((a, b) => a.category.localeCompare(b.category) || byOrder(a, b));
}
export async function addProcedureName(category: string, name: string, preset_id: string | null = null) {
  const user_id = await requireUserId();
  const existing = (await listProcedureNames()).filter((p) => p.category === category);
  const row = await localUpsert("procedure_names", {
    id: newId(), user_id, category, name, preset_id,
    sort_order: existing.length, created_at: nowIso(),
  });
  return row as unknown as ProcedureName;
}
export async function updateProcedureName(id: string, patch: Partial<Pick<ProcedureName, "name" | "preset_id" | "category">>) {
  await localPatch("procedure_names", id, patch);
}
export async function deleteProcedureName(id: string) {
  await localDelete("procedure_names", id);
}
export async function reorderProcedureNames(ids: string[]) {
  for (const [idx, id] of ids.entries()) {
    await localPatch("procedure_names", id, { sort_order: idx });
  }
}

// -------- Presets --------
export type PresetField = { id: string; preset_id: string; label: string; field_type: "text" | "number" | "textarea"; sort_order: number };
export type Preset = {
  id: string;
  name: string;
  defaults: Record<string, unknown>;
  created_at: string;
};

export async function listPresets(): Promise<Preset[]> {
  const all = await localList<Preset>("procedure_presets");
  return all.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
}
export async function listPresetFields(): Promise<PresetField[]> {
  const all = await localList<PresetField>("procedure_preset_fields");
  return all.sort((a, b) => a.preset_id.localeCompare(b.preset_id) || a.sort_order - b.sort_order);
}
export async function addPreset(name: string) {
  const user_id = await requireUserId();
  const row = await localUpsert("procedure_presets", {
    id: newId(), user_id, name, defaults: {}, created_at: nowIso(),
  });
  return row as unknown as Preset;
}
export async function updatePreset(id: string, patch: Partial<Pick<Preset, "name" | "defaults">>) {
  await localPatch("procedure_presets", id, patch);
}
export async function deletePreset(id: string) {
  await localDelete("procedure_presets", id);
}
export async function addPresetField(preset_id: string, label: string, field_type: PresetField["field_type"] = "text") {
  const user_id = await requireUserId();
  const siblings = (await listPresetFields()).filter((f) => f.preset_id === preset_id);
  const row = await localUpsert("procedure_preset_fields", {
    id: newId(), user_id, preset_id, label, field_type,
    sort_order: siblings.length, created_at: nowIso(),
  });
  return row as unknown as PresetField;
}
export async function deletePresetField(id: string) {
  await localDelete("procedure_preset_fields", id);
}

// -------- Scrub in/out --------
export async function scrubIn(input: {
  patient_name?: string; ip_number?: string; diagnosis?: string; name: string; category?: string;
}): Promise<Procedure> {
  const user_id = await requireUserId();
  const now = nowIso();
  const row = await localUpsert("procedures", {
    id: newId(),
    user_id,
    performed_at: now,
    scrub_in_at: now,
    status: "in_progress",
    name: input.name,
    category: input.category || null,
    patient_name: input.patient_name || null,
    ip_number: input.ip_number || null,
    indication: input.diagnosis || null,
    pa_names: [],
    preset_values: {},
    created_at: now,
  });
  return row as unknown as Procedure;
}

export async function scrubOut(id: string): Promise<Procedure> {
  const existing = await localGet<Procedure>("procedures", id);
  if (!existing) throw new Error("Case not found");
  const now = new Date();
  const inAt = existing.scrub_in_at ? new Date(existing.scrub_in_at) : now;
  const total = Math.max(0, Math.round((now.getTime() - inAt.getTime()) / 1000));
  const row = await localPatch("procedures", id, {
    scrub_out_at: now.toISOString(),
    status: "completed",
    total_duration_seconds: total,
  });
  return row as unknown as Procedure;
}

export async function getInProgressProcedure(): Promise<Procedure | null> {
  const all = await localList<Procedure>("procedures");
  const open = all
    .filter((p) => p.status === "in_progress")
    .sort((a, b) => (b.scrub_in_at ?? "").localeCompare(a.scrub_in_at ?? ""));
  return open[0] ?? null;
}

/** Ensure a person's name is prefixed with "Dr." */
export function withDr(name: string | null | undefined): string {
  if (!name) return "";
  const n = name.trim();
  if (!n) return "";
  if (/^dr\.?\s+/i.test(n)) return n.replace(/^dr\.?\s+/i, "Dr. ");
  return `Dr. ${n}`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

// -------- Procedures --------
export async function listProcedures(): Promise<Procedure[]> {
  const all = await localList<Procedure>("procedures");
  return all.sort((a, b) => (b.performed_at ?? "").localeCompare(a.performed_at ?? ""));
}

export async function getProcedure(id: string) {
  const procedure = await localGet<Procedure>("procedures", id);
  if (!procedure) throw new Error("Case not found");
  const steps = (await localList<ProcedureStep>("procedure_steps"))
    .filter((s) => s.procedure_id === id)
    .sort((a, b) => a.order_idx - b.order_idx);
  const attachments = (await localList<Attachment>("procedure_attachments"))
    .filter((a) => a.procedure_id === id)
    .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  return { procedure, steps, attachments };
}

export async function saveProcedure(
  id: string | undefined,
  payload: Record<string, unknown>,
  steps: Array<{ label: string; duration_seconds: number; notes?: string | null }>,
): Promise<string> {
  const user_id = await requireUserId();
  let pid = id;
  if (pid) {
    await localPatch("procedures", pid, payload);
  } else {
    pid = newId();
    await localUpsert("procedures", { ...payload, id: pid, user_id, created_at: nowIso() } as Row);
  }

  const existingSteps = (await localList<ProcedureStep>("procedure_steps")).filter((s) => s.procedure_id === pid);
  for (const s of existingSteps) await localDelete("procedure_steps", s.id);
  for (const [idx, s] of steps.entries()) {
    await localUpsert("procedure_steps", {
      id: newId(),
      procedure_id: pid,
      user_id,
      label: s.label,
      duration_seconds: s.duration_seconds,
      order_idx: idx,
      notes: s.notes ?? null,
      created_at: nowIso(),
    });
  }
  return pid;
}

export async function deleteProcedure(id: string) {
  const steps = (await localList<ProcedureStep>("procedure_steps")).filter((s) => s.procedure_id === id);
  for (const s of steps) await localDelete("procedure_steps", s.id);
  await localDelete("procedures", id);
}

// -------- Attachments (work offline, upload when back online) --------
export async function addAttachment(procedureId: string, file: File): Promise<Attachment> {
  const user_id = await requireUserId();
  const id = newId();
  const path = `${user_id}/${procedureId}/${id}-${file.name}`;
  await queueFileUpload({
    id,
    procedure_id: procedureId,
    storage_path: path,
    filename: file.name,
    mime_type: file.type || null,
    blob: file,
  });
  const row = await localUpsert("procedure_attachments", {
    id,
    procedure_id: procedureId,
    user_id,
    storage_path: path,
    filename: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    created_at: nowIso(),
  });
  return row as unknown as Attachment;
}

export async function getAttachmentUrl(a: Attachment): Promise<string | null> {
  if (hasLocalDb()) {
    const local = await db().files.get(a.id);
    if (local?.blob) return URL.createObjectURL(local.blob);
  }
  const { data } = await supabase.storage.from("procedure-files").createSignedUrl(a.storage_path, 60);
  return data?.signedUrl ?? null;
}

export async function deleteAttachment(a: Attachment): Promise<void> {
  if (hasLocalDb()) await db().files.delete(a.id);
  await localDelete("procedure_attachments", a.id);
  void supabase.storage.from("procedure-files").remove([a.storage_path]);
}

export function exportCsv(procedures: Procedure[]): void {
  const headers = [
    "performed_at","name","category","patient_name","ip_number","site",
    "indication","surgeon","assistant_surgeon","complications","notes","total_duration_seconds",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = procedures.map((p) => headers.map((h) => escape((p as unknown as Record<string, unknown>)[h])).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `procedures-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
