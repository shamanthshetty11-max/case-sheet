import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, BookMarked, Layers, Scissors } from "lucide-react";
import { toast } from "sonner";
import {
  PROCEDURE_CATEGORIES,
  listProcedureNames, addProcedureName, updateProcedureName, deleteProcedureName,
  listPresets, addPreset, deletePreset,
  listPresetFields, addPresetField, deletePresetField,
  listSurgicalApproaches, addSurgicalApproach, deleteSurgicalApproach,
} from "@/lib/procedures";

export const Route = createFileRoute("/_authenticated/catalog")({
  head: () => ({ meta: [{ title: "Catalog — CaseSync" }, { name: "description", content: "Manage procedure names by category and reusable presets." }] }),
  component: CatalogPage,
});

function CatalogPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-sm text-muted-foreground">Build your procedure name dropdown by category and attach reusable presets.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <NamesCard />
        <PresetsCard />
        <ApproachesCard />
      </div>
    </div>
  );
}

function ApproachesCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["surgical_approaches"], queryFn: listSurgicalApproaches });
  const [name, setName] = useState("");
  async function add() {
    if (!name.trim()) return;
    try { await addSurgicalApproach(name.trim()); setName(""); qc.invalidateQueries({ queryKey: ["surgical_approaches"] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }
  async function rm(id: string) {
    try { await deleteSurgicalApproach(id); qc.invalidateQueries({ queryKey: ["surgical_approaches"] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground"><Scissors className="h-4 w-4" /></div>
          <CardTitle className="text-base">Surgical approaches</CardTitle>
        </div>
        <CardDescription>Show up as a dropdown on the New log's Surgical approach field.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input placeholder="e.g. Median sternotomy" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          <Button onClick={add} disabled={!name.trim()}><Plus className="mr-1.5 h-4 w-4" /> Add</Button>
        </div>
        <div className="space-y-1.5">
          {(q.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">No approaches yet.</p>}
          {(q.data ?? []).map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
              <span className="flex-1">{a.name}</span>
              <Button size="icon" variant="ghost" onClick={() => rm(a.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NamesCard() {
  const qc = useQueryClient();
  const namesQ = useQuery({ queryKey: ["procedure_names"], queryFn: listProcedureNames });
  const presetsQ = useQuery({ queryKey: ["procedure_presets"], queryFn: listPresets });
  const [category, setCategory] = useState("Cardiac surgery");
  const [name, setName] = useState("");
  const [presetId, setPresetId] = useState<string>("__none__");

  const inCat = (namesQ.data ?? []).filter((n) => n.category === category);

  async function add() {
    const n = name.trim();
    if (!n) return;
    try {
      await addProcedureName(category, n, presetId === "__none__" ? null : presetId);
      setName("");
      qc.invalidateQueries({ queryKey: ["procedure_names"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }
  async function setPreset(id: string, p: string) {
    try {
      await updateProcedureName(id, { preset_id: p === "__none__" ? null : p });
      qc.invalidateQueries({ queryKey: ["procedure_names"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }
  async function rm(id: string) {
    try { await deleteProcedureName(id); qc.invalidateQueries({ queryKey: ["procedure_names"] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground"><BookMarked className="h-4 w-4" /></div>
          <CardTitle className="text-base">Procedure names</CardTitle>
        </div>
        <CardDescription>Names show up in the New log dropdown once a category is picked.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-1.5"><Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROCEDURE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Preset (optional)</Label>
            <Select value={presetId} onValueChange={setPresetId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {(presetsQ.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-1"><Label className="text-xs invisible">.</Label>
            <Button className="w-full" onClick={add} disabled={!name.trim()}><Plus className="mr-1.5 h-4 w-4" /> Add</Button>
          </div>
          <div className="space-y-1.5 sm:col-span-3"><Label className="text-xs">Procedure name</Label>
            <Input placeholder="e.g. CABG x3" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Under "{category}"</div>
          {inCat.length === 0 ? (
            <p className="text-xs text-muted-foreground">No names yet.</p>
          ) : inCat.map((n) => (
            <div key={n.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
              <span className="flex-1">{n.name}</span>
              <Select value={n.preset_id ?? "__none__"} onValueChange={(v) => setPreset(n.id, v)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="No preset" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No preset</SelectItem>
                  {(presetsQ.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" onClick={() => rm(n.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PresetsCard() {
  const qc = useQueryClient();
  const presetsQ = useQuery({ queryKey: ["procedure_presets"], queryFn: listPresets });
  const fieldsQ = useQuery({ queryKey: ["procedure_preset_fields"], queryFn: listPresetFields });
  const [newName, setNewName] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<"text" | "number" | "textarea">("text");

  async function createPreset() {
    const n = newName.trim();
    if (!n) return;
    try {
      const p = await addPreset(n);
      setNewName("");
      setSelected(p.id);
      qc.invalidateQueries({ queryKey: ["procedure_presets"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }
  async function removePreset(id: string) {
    try { await deletePreset(id); if (selected === id) setSelected(null);
      qc.invalidateQueries({ queryKey: ["procedure_presets"] });
      qc.invalidateQueries({ queryKey: ["procedure_preset_fields"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }
  async function addField() {
    if (!selected || !fieldLabel.trim()) return;
    try {
      await addPresetField(selected, fieldLabel.trim(), fieldType);
      setFieldLabel("");
      qc.invalidateQueries({ queryKey: ["procedure_preset_fields"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }
  async function removeField(id: string) {
    try { await deletePresetField(id); qc.invalidateQueries({ queryKey: ["procedure_preset_fields"] }); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }

  const selectedFields = (fieldsQ.data ?? []).filter((f) => f.preset_id === selected);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground"><Layers className="h-4 w-4" /></div>
          <CardTitle className="text-base">Presets</CardTitle>
        </div>
        <CardDescription>Bundle extra fields for a procedure. Attach the same preset to multiple procedure names.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input placeholder="New preset name (e.g. CABG bundle)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Button onClick={createPreset}><Plus className="mr-1.5 h-4 w-4" /> Create</Button>
        </div>
        <div className="space-y-1.5">
          {(presetsQ.data ?? []).length === 0 && <p className="text-xs text-muted-foreground">No presets yet.</p>}
          {(presetsQ.data ?? []).map((p) => (
            <div key={p.id} className={`flex items-center gap-2 rounded-md border p-2 text-sm ${selected === p.id ? "border-primary bg-primary/5" : "border-border"}`}>
              <button type="button" className="flex-1 text-left" onClick={() => setSelected(p.id)}>{p.name}</button>
              <Button size="icon" variant="ghost" onClick={() => removePreset(p.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        {selected && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="text-xs font-medium text-muted-foreground">Fields on this preset</div>
            {selectedFields.length === 0 ? (
              <p className="text-xs text-muted-foreground">No fields yet.</p>
            ) : selectedFields.map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                <span className="flex-1">{f.label} <span className="text-xs text-muted-foreground">({f.field_type})</span></span>
                <Button size="icon" variant="ghost" onClick={() => removeField(f.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Input placeholder="Field label" value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} />
              <Select value={fieldType} onValueChange={(v) => setFieldType(v as "text" | "number" | "textarea")}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="textarea">Long text</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addField}><Plus className="mr-1.5 h-4 w-4" /> Add</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}