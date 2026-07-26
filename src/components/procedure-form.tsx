import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROCEDURE_CATEGORIES, ROLES, formatDuration, type Procedure, type ProcedureStep, type Attachment } from "@/lib/procedures";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Play, Pause, RotateCcw, Paperclip, X, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { extractProcedureFromImage } from "@/lib/ai.functions";
import { PROCEDURE_CATEGORIES as CATS, ROLES as ROLE_LIST } from "@/lib/procedures";

type StepDraft = { id?: string; label: string; duration_seconds: number; order_idx: number; running?: boolean; startedAt?: number };

export type ProcedureFormValues = {
  performed_at: string;
  name: string;
  category: string;
  patient_ref: string;
  indication: string;
  site: string;
  surgeon: string;
  assistant_surgeon: string;
  role: string;
  difficulty: string;
  outcome: string;
  complications: string;
  lessons: string;
  notes: string;
};

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

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
    patient_ref: initial?.patient_ref ?? "",
    indication: initial?.indication ?? "",
    site: initial?.site ?? "",
    surgeon: initial?.surgeon ?? "",
    assistant_surgeon: initial?.assistant_surgeon ?? "",
    role: initial?.role ?? "",
    difficulty: initial?.difficulty ? String(initial.difficulty) : "",
    outcome: initial?.outcome ?? "",
    complications: initial?.complications ?? "",
    lessons: initial?.lessons ?? "",
    notes: initial?.notes ?? "",
  });
  const [steps, setSteps] = useState<StepDraft[]>(
    initialSteps.map((s) => ({ id: s.id, label: s.label, duration_seconds: s.duration_seconds, order_idx: s.order_idx })),
  );
  const [newStep, setNewStep] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const extract = useServerFn(extractProcedureFromImage);
  const [, setTick] = useState(0);

  useEffect(() => {
    const anyRunning = steps.some((s) => s.running);
    if (!anyRunning) return;
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [steps]);

  function set<K extends keyof ProcedureFormValues>(k: K, val: ProcedureFormValues[K]) {
    setV((s) => ({ ...s, [k]: val }));
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
        apply("patient_ref", result.patient_ref);
        apply("indication", result.indication);
        apply("site", result.site);
        apply("surgeon", result.surgeon);
        apply("assistant_surgeon", result.assistant_surgeon);
        if (result.role && (ROLE_LIST as string[]).includes(result.role)) apply("role", result.role);
        if (result.difficulty && ["1","2","3","4","5"].includes(result.difficulty)) apply("difficulty", result.difficulty);
        apply("outcome", result.outcome);
        apply("complications", result.complications);
        apply("lessons", result.lessons);
        apply("notes", result.notes);
        return next;
      });
      toast.success(applied.length ? `Filled ${applied.length} field${applied.length === 1 ? "" : "s"} from image` : "Nothing recognizable in the image");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  function addStep() {
    if (!newStep.trim()) return;
    setSteps((s) => [...s, { label: newStep.trim(), duration_seconds: 0, order_idx: s.length }]);
    setNewStep("");
  }
  function removeStep(i: number) {
    setSteps((s) => s.filter((_, idx) => idx !== i).map((x, idx) => ({ ...x, order_idx: idx })));
  }
  function toggleStep(i: number) {
    setSteps((s) => s.map((x, idx) => {
      if (idx !== i) return x;
      if (x.running) {
        const elapsed = Math.floor((Date.now() - (x.startedAt ?? Date.now())) / 1000);
        return { ...x, running: false, startedAt: undefined, duration_seconds: x.duration_seconds + elapsed };
      }
      return { ...x, running: true, startedAt: Date.now() };
    }));
  }
  function resetStep(i: number) {
    setSteps((s) => s.map((x, idx) => idx === i ? { ...x, duration_seconds: 0, running: false, startedAt: undefined } : x));
  }
  function stepDisplay(s: StepDraft): number {
    return s.running ? s.duration_seconds + Math.floor((Date.now() - (s.startedAt ?? Date.now())) / 1000) : s.duration_seconds;
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

      const finalizedSteps = steps.map((s) => {
        const dur = s.running ? s.duration_seconds + Math.floor((Date.now() - (s.startedAt ?? Date.now())) / 1000) : s.duration_seconds;
        return { ...s, duration_seconds: dur, running: false, startedAt: undefined };
      });
      const total = finalizedSteps.reduce((n, s) => n + s.duration_seconds, 0);

      const payload = {
        user_id: uid,
        performed_at: new Date(v.performed_at).toISOString(),
        name: v.name.trim(),
        category: v.category || null,
        patient_ref: v.patient_ref || null,
        indication: v.indication || null,
        site: v.site || null,
        surgeon: v.surgeon || null,
        assistant_surgeon: v.assistant_surgeon || null,
        role: v.role || null,
        difficulty: v.difficulty ? Number(v.difficulty) : null,
        outcome: v.outcome || null,
        complications: v.complications || null,
        lessons: v.lessons || null,
        notes: v.notes || null,
        total_duration_seconds: total || null,
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
            <Field label="Date & time"><Input type="datetime-local" required value={v.performed_at} onChange={(e) => set("performed_at", e.target.value)} /></Field>
            <Field label="Procedure name"><Input required placeholder="e.g. Peripheral IV placement" value={v.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Category">
              <Select value={v.category} onValueChange={(x) => set("category", x)}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{PROCEDURE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Patient reference (MRN / initials)"><Input value={v.patient_ref} onChange={(e) => set("patient_ref", e.target.value)} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Clinical detail</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Indication"><Input value={v.indication} onChange={(e) => set("indication", e.target.value)} /></Field>
          <Field label="Site / location"><Input value={v.site} onChange={(e) => set("site", e.target.value)} /></Field>
          <Field label="Surgeon"><Input value={v.surgeon} onChange={(e) => set("surgeon", e.target.value)} /></Field>
          <Field label="Assistant surgeon"><Input value={v.assistant_surgeon} onChange={(e) => set("assistant_surgeon", e.target.value)} /></Field>
          <Field label="Complications" className="md:col-span-2"><Textarea rows={2} value={v.complications} onChange={(e) => set("complications", e.target.value)} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Learning</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Role">
            <Select value={v.role} onValueChange={(x) => set("role", x)}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r!} value={r!} className="capitalize">{r}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Difficulty (1–5)">
            <Select value={v.difficulty} onValueChange={(x) => set("difficulty", x)}>
              <SelectTrigger><SelectValue placeholder="Rate difficulty" /></SelectTrigger>
              <SelectContent>{[1,2,3,4,5].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Lessons learned" className="md:col-span-2"><Textarea rows={3} value={v.lessons} onChange={(e) => set("lessons", e.target.value)} /></Field>
          <Field label="Notes" className="md:col-span-2"><Textarea rows={4} value={v.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timed steps</CardTitle>
          <p className="text-sm text-muted-foreground">Add whatever steps this case calls for. Time them live or enter durations after.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.length > 0 && (
            <div className="space-y-2">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 p-2">
                  <Input value={s.label} onChange={(e) => setSteps((prev) => prev.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} className="flex-1" />
                  <div className="w-16 text-right font-mono text-sm tabular-nums">{formatDuration(stepDisplay(s))}</div>
                  <Button type="button" size="icon" variant="ghost" onClick={() => toggleStep(i)}>
                    {s.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => resetStep(i)}><RotateCcw className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeStep(i)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input placeholder="Add a step (e.g. Prep, Access, Suture)" value={newStep} onChange={(e) => setNewStep(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStep(); } }} />
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