import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PROCEDURE_CATEGORIES,
  formatDuration,
  listTeamPAs,
  listTeamSurgeons,
  addTeamPA,
  addTeamSurgeon,
  withDr,
  listProcedureNames,
  addProcedureName,
  listPresets,
  listPresetFields,
  listSurgicalApproaches,
  addSurgicalApproach,
  NOTES_TEMPLATE,
  type Procedure,
  type ProcedureStep,
  type Attachment,
} from "@/lib/procedures";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Paperclip, X, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { extractProcedureFromImage } from "@/lib/ai.functions";
import { PROCEDURE_CATEGORIES as CATS } from "@/lib/procedures";
import { useBlocker } from "@tanstack/react-router";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type StepDraft = { id?: string; label: string; duration_seconds: number; order_idx: number };

export type ProcedureFormValues = {
  performed_at: string;
  name: string;
  category: string;
  patient_name: string;
  ip_number: string;
  patient_height_cm: string;
  patient_weight_kg: string;
  diagnosis: string;
  surgical_approach: string;
  surgeon: string;
  assistant_surgeon: string;
  complications: string;
  notes: string;
  closed_by: string;
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

const NEW_VALUE = "__new__";

export function ProcedureForm({
  initial,
  initialSteps = [],
  initialAttachments = [],
  procedureId,
  onSaved,
}: {
  initial?: Partial<Procedure>;
  initialSteps?: ProcedureStep[];
  initialAttachments?: Attachment[];
  procedureId?: string;
  onSaved: (id: string) => void;
}) {
  const [v, setV] = useState<ProcedureFormValues>({
    performed_at: toLocalInput(initial?.performed_at ?? new Date().toISOString()),
    name: initial?.name ?? "",
    category: initial?.category ?? "",
    patient_name: initial?.patient_name ?? "",
    ip_number: initial?.ip_number ?? "",
    patient_height_cm: initial?.patient_height_cm != null ? String(initial.patient_height_cm) : "",
    patient_weight_kg: initial?.patient_weight_kg != null ? String(initial.patient_weight_kg) : "",
    diagnosis: initial?.indication ?? "",
    surgical_approach: initial?.site ?? "",
    surgeon: initial?.surgeon ?? "",
    assistant_surgeon: initial?.assistant_surgeon ?? "",
    complications: initial?.complications ?? "",
    notes: initial?.notes ?? (procedureId ? "" : NOTES_TEMPLATE),
    closed_by: initial?.closed_by ?? "",
  });
  const [paNames, setPaNames] = useState<string[]>(initial?.pa_names ?? []);
  const [presetValues, setPresetValues] = useState<Record<string, string>>(
    (initial?.preset_values as Record<string, string> | null) ?? {},
  );
  const [presetId, setPresetId] = useState<string | null>(initial?.preset_id ?? null);
  const [dirty, setDirty] = useState(false);
  const [steps, setSteps] = useState<StepDraft[]>(
    initialSteps.map((s) => ({ id: s.id, label: s.label, duration_seconds: s.duration_seconds, order_idx: s.order_idx })),
  );
  const [newStep, setNewStep] = useState("");
  const [newStepMin, setNewStepMin] = useState<string>("");
  const [newStepSec, setNewStepSec] = useState<string>("");
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const extract = useServerFn(extractProcedureFromImage);

  const qc = useQueryClient();
  const surgeonsQ = useQuery({ queryKey: ["team_surgeons"], queryFn: listTeamSurgeons });
  const pasQ = useQuery({ queryKey: ["team_pas"], queryFn: listTeamPAs });
  const namesQ = useQuery({ queryKey: ["procedure_names"], queryFn: listProcedureNames });
  const presetsQ = useQuery({ queryKey: ["procedure_presets"], queryFn: listPresets });
  const presetFieldsQ = useQuery({ queryKey: ["procedure_preset_fields"], queryFn: listPresetFields });
  const approachesQ = useQuery({ queryKey: ["surgical_approaches"], queryFn: listSurgicalApproaches });

  const namesInCategory = useMemo(
    () => (namesQ.data ?? []).filter((n) => n.category === v.category),
    [namesQ.data, v.category],
  );
  const activePresetFields = useMemo(
    () => (presetFieldsQ.data ?? []).filter((f) => f.preset_id === presetId),
    [presetFieldsQ.data, presetId],
  );

  // When the user picks a saved procedure name, auto-load its preset defaults + preset id
  function applyProcedureName(name: string) {
    setV((prev) => ({ ...prev, name }));
    const entry = (namesQ.data ?? []).find((n) => n.category === v.category && n.name === name);
    if (entry?.preset_id) {
      setPresetId(entry.preset_id);
      const preset = (presetsQ.data ?? []).find((p) => p.id === entry.preset_id);
      if (preset?.defaults && typeof preset.defaults === "object") {
        const d = preset.defaults as Record<string, string>;
        setV((prev) => ({
          ...prev,
          surgical_approach: prev.surgical_approach || d.surgical_approach || "",
          diagnosis: prev.diagnosis || d.diagnosis || "",
        }));
      }
    } else {
      setPresetId(null);
    }
  }

  // useBlocker: prompt before leaving with unsaved changes
  const { proceed, reset, status } = useBlocker({
    shouldBlockFn: () => dirty && !saving,
    withResolver: true,
  });

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function set<K extends keyof ProcedureFormValues>(k: K, val: ProcedureFormValues[K]) {
    setV((s) => ({ ...s, [k]: val }));
    setDirty(true);
  }

  async function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setScanning(true);
    try {
      const imageDataUrl = await readAsDataUrl(file);
      const result = await extract({ data: { imageDataUrl } });
      const applied: string[] = [];
      setV((prev) => {
        const next = { ...prev };
        const apply = (k: keyof ProcedureFormValues, val: string | null | undefined) => {
          if (!val) return;
          if (prev[k] && prev[k].trim()) return;
          next[k] = val;
          applied.push(k);
        };
        apply("name", result.name);
        if (result.category && CATS.includes(result.category)) apply("category", result.category);
        if (result.patient_ref && !prev.patient_name) { next.patient_name = result.patient_ref; applied.push("patient_name"); }
        apply("diagnosis", result.diagnosis);
        apply("surgical_approach", result.surgical_approach);
        apply("surgeon", result.surgeon);
        apply("assistant_surgeon", result.assistant_surgeon);
        apply("complications", result.complications);
        if (result.notes && (!prev.notes.trim() || prev.notes === NOTES_TEMPLATE)) {
          next.notes = result.notes;
          applied.push("notes");
        }
        return next;
      });
      if (result.pa_names?.length) {
        setPaNames((prev) => {
          const set = new Set(prev);
          for (const n of result.pa_names!) if (n?.trim()) set.add(n.trim());
          if (set.size > prev.length) applied.push("pa_names");
          return Array.from(set);
        });
      }
      toast.success(applied.length ? `Filled ${applied.length} field${applied.length === 1 ? "" : "s"} from image` : "Nothing recognizable in the image");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  function addStep() {
    if (!newStep.trim()) return;
    const mins = Math.max(0, parseInt(newStepMin || "0", 10) || 0);
    const secs = Math.max(0, Math.min(59, parseInt(newStepSec || "0", 10) || 0));
    setSteps((s) => [...s, { label: newStep.trim(), duration_seconds: mins * 60 + secs, order_idx: s.length }]);
    setNewStep("");
    setNewStepMin("");
    setNewStepSec("");
  }
  function removeStep(i: number) {
    setSteps((s) => s.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, order_idx: idx })));
  }
  function updateStep(i: number, patch: Partial<StepDraft>) {
    setSteps((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function stepMinSec(sec: number): { m: number; s: number } {
    const total = Math.max(0, Math.floor(sec));
    return { m: Math.floor(total / 60), s: total % 60 };
  }

  async function addNewSurgeon(): Promise<string | null> {
    const name = window.prompt("Add surgeon (name only, 'Dr.' is added automatically):");
    if (!name?.trim()) return null;
    try {
      const clean = name.trim().replace(/^dr\.?\s+/i, "");
      await addTeamSurgeon(clean);
      qc.invalidateQueries({ queryKey: ["team_surgeons"] });
      return clean;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save surgeon");
      return null;
    }
  }
  async function addNewPA(): Promise<string | null> {
    const name = window.prompt("Add physician assistant name:");
    if (!name?.trim()) return null;
    try {
      const clean = name.trim();
      await addTeamPA(clean);
      qc.invalidateQueries({ queryKey: ["team_pas"] });
      return clean;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save PA");
      return null;
    }
  }

  async function addNewProcedureName(): Promise<string | null> {
    if (!v.category) { toast.info("Pick a category first"); return null; }
    const name = window.prompt(`Add a procedure name under "${v.category}":`);
    if (!name?.trim()) return null;
    try {
      const created = await addProcedureName(v.category, name.trim());
      qc.invalidateQueries({ queryKey: ["procedure_names"] });
      return created.name;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save name");
      return null;
    }
  }

  async function addNewApproach(): Promise<string | null> {
    const name = window.prompt("Add a surgical approach:");
    if (!name?.trim()) return null;
    try {
      const created = await addSurgicalApproach(name.trim());
      qc.invalidateQueries({ queryKey: ["surgical_approaches"] });
      return created.name;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save approach");
      return null;
    }
  }

  async function addNewClosureMember(): Promise<{ name: string; kind: "surgeon" | "pa" } | null> {
    const kindRaw = window.prompt("Add closure member — type 'S' for surgeon or 'P' for physician assistant:", "S");
    if (!kindRaw) return null;
    const kind: "surgeon" | "pa" = /^p/i.test(kindRaw.trim()) ? "pa" : "surgeon";
    const name = window.prompt(kind === "surgeon" ? "Surgeon name (Dr. added automatically):" : "PA name:");
    if (!name?.trim()) return null;
    try {
      const clean = kind === "surgeon" ? name.trim().replace(/^dr\.?\s+/i, "") : name.trim();
      if (kind === "surgeon") { await addTeamSurgeon(clean); qc.invalidateQueries({ queryKey: ["team_surgeons"] }); }
      else { await addTeamPA(clean); qc.invalidateQueries({ queryKey: ["team_pas"] }); }
      return { name: clean, kind };
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      return null;
    }
  }

  async function uploadFiles(files: FileList | null, pid: string) {
    if (!files || !files.length) return [] as Attachment[];
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) throw new Error("Not signed in");
    const results: Attachment[] = [];
    for (const file of Array.from(files)) {
      const path = `${uid}/${pid}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("procedure-files").upload(path, file);
      if (upErr) throw upErr;
      const { data: row, error: rowErr } = await supabase.from("procedure_attachments").insert({
        procedure_id: pid, user_id: uid, storage_path: path, filename: file.name, mime_type: file.type, size_bytes: file.size,
      }).select().single();
      if (rowErr) throw rowErr;
      results.push(row as Attachment);
    }
    return results;
  }

  async function handleAttachmentChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!procedureId) { toast.info("Save the procedure first, then add attachments."); e.target.value = ""; return; }
    try {
      const added = await uploadFiles(e.target.files, procedureId);
      setAttachments((a) => [...a, ...added]);
      toast.success(`Uploaded ${added.length} file${added.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      e.target.value = "";
    }
  }

  async function downloadAttachment(a: Attachment) {
    const { data, error } = await supabase.storage.from("procedure-files").createSignedUrl(a.storage_path, 60);
    if (error) { toast.error(error.message); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function removeAttachment(a: Attachment) {
    await supabase.storage.from("procedure-files").remove([a.storage_path]);
    await supabase.from("procedure_attachments").delete().eq("id", a.id);
    setAttachments((prev) => prev.filter((x) => x.id !== a.id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");

      const finalizedSteps = steps.map((s) => ({ ...s, duration_seconds: Math.max(0, s.duration_seconds | 0) }));
      const total = finalizedSteps.reduce((n, s) => n + s.duration_seconds, 0);

      const payload = {
        user_id: uid,
        performed_at: new Date(v.performed_at).toISOString(),
        name: v.name.trim(),
        category: v.category || null,
        patient_name: v.patient_name || null,
        ip_number: v.ip_number || null,
        patient_height_cm: v.patient_height_cm ? Number(v.patient_height_cm) : null,
        patient_weight_kg: v.patient_weight_kg ? Number(v.patient_weight_kg) : null,
        indication: v.diagnosis || null,
        site: v.surgical_approach || null,
        surgeon: v.surgeon || null,
        assistant_surgeon: v.assistant_surgeon || null,
        pa_names: paNames.length ? paNames : undefined,
        complications: v.complications || null,
        notes: v.notes && v.notes !== NOTES_TEMPLATE ? v.notes : null,
        total_duration_seconds: total || null,
        closed_by: v.closed_by || null,
        preset_id: presetId,
        preset_values: Object.keys(presetValues).length ? presetValues : null,
        status: initial?.status === "in_progress" ? "completed" : (initial?.status ?? "completed"),
      };

      let pid = procedureId;
      if (pid) {
        const { error } = await supabase.from("procedures").update(payload).eq("id", pid);
        if (error) throw error;
        await supabase.from("procedure_steps").delete().eq("procedure_id", pid);
      } else {
        const { data, error } = await supabase.from("procedures").insert(payload).select().single();
        if (error) throw error;
        pid = data.id;
      }

      if (finalizedSteps.length && pid) {
        const rows = finalizedSteps.map((s, i) => ({
          procedure_id: pid, user_id: uid, label: s.label,
          duration_seconds: s.duration_seconds, order_idx: i,
        }));
        const { error } = await supabase.from("procedure_steps").insert(rows);
        if (error) throw error;
      }

      setDirty(false);
      toast.success(procedureId ? "Updated" : "Procedure saved");
      onSaved(pid!);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="font-medium">Scan case details</div>
              <p className="text-sm text-muted-foreground">Snap a photo of your notes, a form, or a whiteboard. AI fills in what it can.</p>
            </div>
          </div>
          <div>
            <input id="scan-input" type="file" accept="image/*" className="hidden" onChange={handleScan} />
            <Button type="button" variant="secondary" disabled={scanning} onClick={() => document.getElementById("scan-input")?.click()}>
              <Sparkles className="mr-1.5 h-4 w-4" /> {scanning ? "Reading image…" : "Scan image"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Core</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Patient name"><Input value={v.patient_name} onChange={(e) => set("patient_name", e.target.value)} /></Field>
            <Field label="IP number"><Input value={v.ip_number} onChange={(e) => set("ip_number", e.target.value)} /></Field>
            <Field label="Category">
              <Select value={v.category} onValueChange={(x) => set("category", x)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{PROCEDURE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date & time"><Input type="datetime-local" required value={v.performed_at} onChange={(e) => set("performed_at", e.target.value)} /></Field>
            <Field label="Procedure name">
              <ProcedureNameSelect
                value={v.name}
                options={namesInCategory.map((n) => n.name)}
                categorySelected={!!v.category}
                onChange={(name) => applyProcedureName(name)}
                onAddNew={addNewProcedureName}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Height (cm)"><Input type="number" min={0} step="0.1" value={v.patient_height_cm} onChange={(e) => set("patient_height_cm", e.target.value)} /></Field>
            <Field label="Weight (kg)"><Input type="number" min={0} step="0.1" value={v.patient_weight_kg} onChange={(e) => set("patient_weight_kg", e.target.value)} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Clinical detail</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Diagnosis"><Input value={v.diagnosis} onChange={(e) => set("diagnosis", e.target.value)} /></Field>
          <Field label="Surgical approach">
            <ApproachSelect
              value={v.surgical_approach}
              options={(approachesQ.data ?? []).map((a) => a.name)}
              onChange={(name) => set("surgical_approach", name)}
              onAddNew={addNewApproach}
            />
          </Field>
          <Field label="Surgeon">
            <SurgeonSelect
              value={v.surgeon}
              options={(surgeonsQ.data ?? []).map((s) => s.name)}
              onChange={(name) => set("surgeon", name)}
              onAddNew={addNewSurgeon}
            />
          </Field>
          <Field label="Assistant surgeon">
            <SurgeonSelect
              value={v.assistant_surgeon}
              options={(surgeonsQ.data ?? []).map((s) => s.name)}
              onChange={(name) => set("assistant_surgeon", name)}
              onAddNew={addNewSurgeon}
            />
          </Field>
          <Field label="Physician assistants" className="md:col-span-2">
            <PaMultiSelect
              selected={paNames}
              options={(pasQ.data ?? []).map((p) => p.name)}
              onChange={setPaNames}
              onAddNew={addNewPA}
            />
          </Field>
          <Field label="Complications" className="md:col-span-2"><Textarea rows={2} value={v.complications} onChange={(e) => set("complications", e.target.value)} /></Field>
        </CardContent>
      </Card>

      {activePresetFields.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Preset fields</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {activePresetFields.map((f) => (
              <Field key={f.id} label={f.label} className={f.field_type === "textarea" ? "md:col-span-2" : ""}>
                {f.field_type === "textarea" ? (
                  <Textarea rows={3} value={presetValues[f.label] ?? ""} onChange={(e) => { setPresetValues((p) => ({ ...p, [f.label]: e.target.value })); setDirty(true); }} />
                ) : (
                  <Input type={f.field_type === "number" ? "number" : "text"} value={presetValues[f.label] ?? ""} onChange={(e) => { setPresetValues((p) => ({ ...p, [f.label]: e.target.value })); setDirty(true); }} />
                )}
              </Field>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
        <CardContent>
          <Field label="Notes"><Textarea rows={5} value={v.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Closure</CardTitle></CardHeader>
        <CardContent>
          <Field label="Closed by">
            <SurgeonSelect
              value={v.closed_by}
              options={(surgeonsQ.data ?? []).map((s) => s.name)}
              onChange={(name) => set("closed_by", name)}
              onAddNew={addNewSurgeon}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timed steps</CardTitle>
          <p className="text-sm text-muted-foreground">Name the step and enter how long it took. Total time is summed automatically.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.length > 0 && (
            <div className="space-y-2">
              {steps.map((s, i) => (
                <StepRow key={i} step={s} onChange={(patch) => updateStep(i, patch)} onRemove={() => removeStep(i)} />
              ))}
              <div className="pt-1 text-right text-xs text-muted-foreground">
                Total: <span className="font-mono">{formatDuration(steps.reduce((n, s) => n + s.duration_seconds, 0))}</span>
              </div>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Step name</Label>
              <Input placeholder="e.g. Sternotomy, Bypass, Closure" value={newStep} onChange={(e) => setNewStep(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStep(); } }} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Min</Label>
              <Input type="number" min={0} className="w-20" placeholder="0" value={newStepMin} onChange={(e) => setNewStepMin(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sec</Label>
              <Input type="number" min={0} max={59} className="w-20" placeholder="0" value={newStepSec} onChange={(e) => setNewStepSec(e.target.value)} />
            </div>
            <Button type="button" variant="outline" onClick={addStep}><Plus className="mr-1.5 h-4 w-4" /> Add step</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Attachments</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {attachments.length > 0 && (
            <div className="space-y-1.5">
              {attachments.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                  <div className="flex items-center gap-2 truncate"><Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="truncate">{a.filename}</span></div>
                  <div className="flex gap-1">
                    <Button type="button" size="icon" variant="ghost" onClick={() => downloadAttachment(a)}><Download className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeAttachment(a)}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div>
            <input id="file-input" type="file" multiple className="hidden" onChange={handleAttachmentChange} />
            <Button type="button" variant="outline" onClick={() => document.getElementById("file-input")?.click()}>
              <Paperclip className="mr-1.5 h-4 w-4" /> {procedureId ? "Add files" : "Save first to add files"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : procedureId ? "Save changes" : "Save procedure"}</Button>
      </div>

      <AlertDialog open={status === "blocked"} onOpenChange={(o) => { if (!o) reset?.(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes on this log. Leaving now will discard them.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => reset?.()}>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => proceed?.()}>Discard &amp; leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function SurgeonSelect({
  value,
  options,
  onChange,
  onAddNew,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  onAddNew: () => Promise<string | null>;
}) {
  const clean = value.replace(/^dr\.?\s+/i, "");
  return (
    <Select
      value={clean || ""}
      onValueChange={async (val) => {
        if (val === NEW_VALUE) {
          const added = await onAddNew();
          if (added) onChange(added);
          return;
        }
        onChange(val);
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select surgeon">{clean ? withDr(clean) : undefined}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {clean && !options.includes(clean) && (
          <SelectItem value={clean}>{withDr(clean)}</SelectItem>
        )}
        {options.map((o) => (
          <SelectItem key={o} value={o}>{withDr(o)}</SelectItem>
        ))}
        <SelectItem value={NEW_VALUE}>+ Add new surgeon…</SelectItem>
      </SelectContent>
    </Select>
  );
}

function PaMultiSelect({
  selected,
  options,
  onChange,
  onAddNew,
}: {
  selected: string[];
  options: string[];
  onChange: (next: string[]) => void;
  onAddNew: () => Promise<string | null>;
}) {
  const available = options.filter((o) => !selected.includes(o));
  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((n) => (
            <span key={n} className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-xs">
              {n}
              <button type="button" onClick={() => onChange(selected.filter((x) => x !== n))} aria-label={`Remove ${n}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Select
        value=""
        onValueChange={async (val) => {
          if (val === NEW_VALUE) {
            const added = await onAddNew();
            if (added && !selected.includes(added)) onChange([...selected, added]);
            return;
          }
          if (!selected.includes(val)) onChange([...selected, val]);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={selected.length ? "Add another PA" : "Select PA(s)"} />
        </SelectTrigger>
        <SelectContent>
          {available.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          <SelectItem value={NEW_VALUE}>+ Add new PA…</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function StepRow({ step, onChange, onRemove }: { step: StepDraft; onChange: (p: Partial<StepDraft>) => void; onRemove: () => void }) {
  const m = Math.floor(step.duration_seconds / 60);
  const s = step.duration_seconds % 60;
  return (
    <div className="grid gap-2 rounded-md border border-border bg-secondary/40 p-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
      <Input value={step.label} onChange={(e) => onChange({ label: e.target.value })} />
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={0}
          className="w-16"
          value={m}
          onChange={(e) => {
            const mm = Math.max(0, parseInt(e.target.value || "0", 10) || 0);
            onChange({ duration_seconds: mm * 60 + s });
          }}
        />
        <span className="text-xs text-muted-foreground">m</span>
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={0}
          max={59}
          className="w-16"
          value={s}
          onChange={(e) => {
            const ss = Math.max(0, Math.min(59, parseInt(e.target.value || "0", 10) || 0));
            onChange({ duration_seconds: m * 60 + ss });
          }}
        />
        <span className="text-xs text-muted-foreground">s</span>
      </div>
      <Button type="button" size="icon" variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}

function ProcedureNameSelect({
  value,
  options,
  categorySelected,
  onChange,
  onAddNew,
}: {
  value: string;
  options: string[];
  categorySelected: boolean;
  onChange: (v: string) => void;
  onAddNew: () => Promise<string | null>;
}) {
  const [manual, setManual] = useState(false);
  const inList = value && options.includes(value);
  if (manual || (value && !inList) || !categorySelected) {
    return (
      <div className="flex gap-1">
        <Input required placeholder="e.g. CABG x3" value={value} onChange={(e) => onChange(e.target.value)} />
        {categorySelected && (
          <Button type="button" variant="ghost" size="icon" aria-label="Pick from list" onClick={() => setManual(false)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }
  return (
    <Select
      value={value || ""}
      onValueChange={async (val) => {
        if (val === NEW_VALUE) {
          const added = await onAddNew();
          if (added) onChange(added);
          return;
        }
        if (val === "__manual__") { setManual(true); onChange(""); return; }
        onChange(val);
      }}
    >
      <SelectTrigger><SelectValue placeholder="Select procedure name" /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        <SelectItem value={NEW_VALUE}>+ Add to catalog…</SelectItem>
        <SelectItem value="__manual__">Type a one-off name…</SelectItem>
      </SelectContent>
    </Select>
  );
}