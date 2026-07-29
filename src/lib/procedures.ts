import { supabase } from "@/integrations/supabase/client";

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

export type TeamMember = { id: string; name: string; created_at: string; sort_order?: number };

export async function listTeamSurgeons(): Promise<TeamMember[]> {
  const { data, error } = await supabase.from("team_surgeons").select("id,name,created_at,sort_order").order("sort_order").order("created_at");
  if (error) throw error;
  return (data ?? []) as TeamMember[];
}
export async function listTeamPAs(): Promise<TeamMember[]> {
  const { data, error } = await supabase.from("team_pas").select("id,name,created_at,sort_order").order("sort_order").order("created_at");
  if (error) throw error;
  return (data ?? []) as TeamMember[];
}
export async function addTeamSurgeon(name: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase.from("team_surgeons").insert({ user_id: u.user.id, name }).select().single();
  if (error) throw error;
  return data as TeamMember;
}
export async function addTeamPA(name: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase.from("team_pas").insert({ user_id: u.user.id, name }).select().single();
  if (error) throw error;
  return data as TeamMember;
}
export async function deleteTeamSurgeon(id: string) {
  const { error } = await supabase.from("team_surgeons").delete().eq("id", id);
  if (error) throw error;
}
export async function deleteTeamPA(id: string) {
  const { error } = await supabase.from("team_pas").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderTeam(table: "team_surgeons" | "team_pas", ids: string[]) {
  await Promise.all(
    ids.map((id, idx) => supabase.from(table).update({ sort_order: idx }).eq("id", id)),
  );
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
  const { data, error } = await supabase
    .from("procedure_names")
    .select("id,category,name,sort_order,preset_id,created_at")
    .order("category").order("sort_order").order("created_at");
  if (error) throw error;
  return (data ?? []) as ProcedureName[];
}
export async function addProcedureName(category: string, name: string, preset_id: string | null = null) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase.from("procedure_names").insert({
    user_id: u.user.id, category, name, preset_id,
  }).select().single();
  if (error) throw error;
  return data as ProcedureName;
}
export async function updateProcedureName(id: string, patch: Partial<Pick<ProcedureName, "name" | "preset_id" | "category">>) {
  const { error } = await supabase.from("procedure_names").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteProcedureName(id: string) {
  const { error } = await supabase.from("procedure_names").delete().eq("id", id);
  if (error) throw error;
}
export async function reorderProcedureNames(ids: string[]) {
  await Promise.all(ids.map((id, idx) => supabase.from("procedure_names").update({ sort_order: idx }).eq("id", id)));
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
  const { data, error } = await supabase.from("procedure_presets").select("id,name,defaults,created_at").order("created_at");
  if (error) throw error;
  return (data ?? []) as Preset[];
}
export async function listPresetFields(): Promise<PresetField[]> {
  const { data, error } = await supabase.from("procedure_preset_fields").select("id,preset_id,label,field_type,sort_order").order("preset_id").order("sort_order");
  if (error) throw error;
  return (data ?? []) as PresetField[];
}
export async function addPreset(name: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase.from("procedure_presets").insert({ user_id: u.user.id, name, defaults: {} }).select().single();
  if (error) throw error;
  return data as Preset;
}
export async function updatePreset(id: string, patch: Partial<Pick<Preset, "name" | "defaults">>) {
  const { error } = await supabase.from("procedure_presets").update(patch as never).eq("id", id);
  if (error) throw error;
}
export async function deletePreset(id: string) {
  const { error } = await supabase.from("procedure_presets").delete().eq("id", id);
  if (error) throw error;
}
export async function addPresetField(preset_id: string, label: string, field_type: PresetField["field_type"] = "text") {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await supabase.from("procedure_preset_fields").insert({
    user_id: u.user.id, preset_id, label, field_type,
  }).select().single();
  if (error) throw error;
  return data as PresetField;
}
export async function deletePresetField(id: string) {
  const { error } = await supabase.from("procedure_preset_fields").delete().eq("id", id);
  if (error) throw error;
}

// -------- Scrub in/out --------
export async function scrubIn(input: {
  patient_name?: string; ip_number?: string; diagnosis?: string; name: string; category?: string;
}): Promise<Procedure> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("procedures").insert({
    user_id: u.user.id,
    performed_at: now,
    scrub_in_at: now,
    status: "in_progress",
    name: input.name,
    category: input.category || null,
    patient_name: input.patient_name || null,
    ip_number: input.ip_number || null,
    indication: input.diagnosis || null,
  }).select().single();
  if (error) throw error;
  return data as Procedure;
}

export async function scrubOut(id: string): Promise<Procedure> {
  const { data: existing, error: e1 } = await supabase.from("procedures").select("scrub_in_at").eq("id", id).single();
  if (e1) throw e1;
  const now = new Date();
  const inAt = existing?.scrub_in_at ? new Date(existing.scrub_in_at) : now;
  const total = Math.max(0, Math.round((now.getTime() - inAt.getTime()) / 1000));
  const { data, error } = await supabase.from("procedures").update({
    scrub_out_at: now.toISOString(),
    status: "completed",
    total_duration_seconds: total,
  }).eq("id", id).select().single();
  if (error) throw error;
  return data as Procedure;
}

export async function getInProgressProcedure(): Promise<Procedure | null> {
  const { data, error } = await supabase.from("procedures").select("*").eq("status", "in_progress").order("scrub_in_at", { ascending: false }).limit(1);
  if (error) throw error;
  return (data?.[0] as Procedure) ?? null;
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

export async function listProcedures() {
  const { data, error } = await supabase
    .from("procedures")
    .select("*")
    .order("performed_at", { ascending: false });
  if (error) throw error;
  return data as Procedure[];
}

export async function getProcedure(id: string) {
  const [{ data: proc, error: e1 }, { data: steps, error: e2 }, { data: atts, error: e3 }] = await Promise.all([
    supabase.from("procedures").select("*").eq("id", id).single(),
    supabase.from("procedure_steps").select("*").eq("procedure_id", id).order("order_idx"),
    supabase.from("procedure_attachments").select("*").eq("procedure_id", id).order("created_at"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  return {
    procedure: proc as Procedure,
    steps: (steps ?? []) as ProcedureStep[],
    attachments: (atts ?? []) as Attachment[],
  };
}

export function exportCsv(procedures: Procedure[]): void {
  const headers = [
    "performed_at","name","category","role","difficulty","patient_ref","site",
    "indication","surgeon","assistant_surgeon","outcome","complications","lessons","notes","total_duration_seconds",
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