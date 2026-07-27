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

export type TeamMember = { id: string; name: string; created_at: string };

export async function listTeamSurgeons(): Promise<TeamMember[]> {
  const { data, error } = await supabase.from("team_surgeons").select("id,name,created_at").order("name");
  if (error) throw error;
  return (data ?? []) as TeamMember[];
}
export async function listTeamPAs(): Promise<TeamMember[]> {
  const { data, error } = await supabase.from("team_pas").select("id,name,created_at").order("name");
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