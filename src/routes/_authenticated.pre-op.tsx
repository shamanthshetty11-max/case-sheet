import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileImage } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/pre-op")({
  head: () => ({
    meta: [
      { title: "Pre-op notes — CaseSync" },
      { name: "description", content: "Prepare pre-operative patient details and save an A4 notes image." },
      { property: "og:title", content: "Pre-op notes — CaseSync" },
      { property: "og:description", content: "Prepare pre-operative patient details and save an A4 notes image." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PreOpPage,
});

type PreOpFields = {
  name: string;
  age: string;
  weight: string;
  ipNumber: string;
  case: string;
  diagnosis: string;
  previousSurgery: string;
  echoFindings: string;
  cagFindings: string;
  notes: string;
};

const EMPTY_FIELDS: PreOpFields = {
  name: "",
  age: "",
  weight: "",
  ipNumber: "",
  case: "",
  diagnosis: "",
  previousSurgery: "",
  echoFindings: "",
  cagFindings: "",
  notes: "",
};

const PREVIEW_WIDTH = 794;
const PREVIEW_HEIGHT = 1123;

type DocumentBlock = {
  label: string;
  value: string;
  lines: string[];
  height: number;
};

type DocumentLayout = {
  patientRows: [DocumentBlock, DocumentBlock][];
  caseBlocks: DocumentBlock[];
  historyBlocks: DocumentBlock[];
  noteBlock: DocumentBlock;
  fontSize: number;
  lineHeight: number;
  totalHeight: number;
};

function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number, fontSize: number): string[] {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];
  ctx.font = `${fontSize}px Arial, sans-serif`;

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.trim().split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > width) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }

  return lines;
}

function measureBlock(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  width: number,
  fontSize: number,
  lineHeight: number,
  minHeight: number,
): DocumentBlock {
  const lines = wrapText(ctx, value, width - 20, fontSize);
  return {
    label,
    value,
    lines,
    height: Math.max(minHeight, 34 + Math.max(1, lines.length) * lineHeight),
  };
}

function createDocumentLayout(
  ctx: CanvasRenderingContext2D,
  fields: PreOpFields,
  fontSize: number,
): DocumentLayout {
  const contentWidth = PREVIEW_WIDTH - 128;
  const gap = 22;
  const columnWidth = (contentWidth - gap) / 2;
  const lineHeight = fontSize * 1.38;
  const patientValues: [string, string][] = [
    ["Name", fields.name],
    ["Age", fields.age ? `${fields.age} years` : ""],
    ["Weight", fields.weight ? `${fields.weight} kg` : ""],
    ["IP number", fields.ipNumber],
  ];
  const patientRows: [DocumentBlock, DocumentBlock][] = [
    [
      measureBlock(ctx, patientValues[0][0], patientValues[0][1], columnWidth, fontSize, lineHeight, 56),
      measureBlock(ctx, patientValues[1][0], patientValues[1][1], columnWidth, fontSize, lineHeight, 56),
    ],
    [
      measureBlock(ctx, patientValues[2][0], patientValues[2][1], columnWidth, fontSize, lineHeight, 56),
      measureBlock(ctx, patientValues[3][0], patientValues[3][1], columnWidth, fontSize, lineHeight, 56),
    ],
  ];
  const caseBlocks = [
    measureBlock(ctx, "Case", fields.case, contentWidth, fontSize, lineHeight, 56),
    measureBlock(ctx, "Diagnosis", fields.diagnosis, contentWidth, fontSize, lineHeight, 56),
  ];
  const historyBlocks = [
    measureBlock(ctx, "Previous surgery", fields.previousSurgery, contentWidth, fontSize, lineHeight, 56),
    measureBlock(ctx, "Echo findings", fields.echoFindings, contentWidth, fontSize, lineHeight, 56),
    measureBlock(ctx, "CAG findings", fields.cagFindings, contentWidth, fontSize, lineHeight, 56),
  ];
  const noteBlock = measureBlock(ctx, "Notes", fields.notes, contentWidth, fontSize, lineHeight, 148);
  const sectionHeading = 30;
  const totalHeight =
    sectionHeading + patientRows.reduce((sum, row) => sum + Math.max(row[0].height, row[1].height) + 8, 0) +
    sectionHeading + caseBlocks.reduce((sum, block) => sum + block.height + 8, 0) +
    sectionHeading + historyBlocks.reduce((sum, block) => sum + block.height + 6, 0) +
    sectionHeading + noteBlock.height;

  return { patientRows, caseBlocks, historyBlocks, noteBlock, fontSize, lineHeight, totalHeight };
}

function drawPreOpDocument(canvas: HTMLCanvasElement, fields: PreOpFields): boolean {
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const scale = canvas.width / PREVIEW_WIDTH;
  ctx.scale(scale, scale);

  const styles = getComputedStyle(document.documentElement);
  const paper = styles.getPropertyValue("--paper").trim();
  const foreground = styles.getPropertyValue("--paper-foreground").trim();
  const muted = styles.getPropertyValue("--paper-muted").trim();
  const border = styles.getPropertyValue("--paper-border").trim();
  const accent = styles.getPropertyValue("--primary").trim();

  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

  const margin = 64;
  const contentWidth = PREVIEW_WIDTH - margin * 2;
  ctx.fillStyle = accent;
  ctx.fillRect(margin, 57, 4, 18);
  ctx.fillStyle = muted;
  ctx.font = "600 10px Arial, sans-serif";
  ctx.fillText("CASESYNC  /  PRE-OPERATIVE", margin + 13, 70);
  ctx.fillStyle = foreground;
  ctx.font = "700 26px Arial, sans-serif";
  ctx.fillText("Pre-operative notes", margin, 108);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, 130);
  ctx.lineTo(PREVIEW_WIDTH - margin, 130);
  ctx.stroke();

  const top = 151;
  const bottom = PREVIEW_HEIGHT - 57;
  let fontSize = 14;
  let layout = createDocumentLayout(ctx, fields, fontSize);
  while (layout.totalHeight > bottom - top && fontSize > 9) {
    fontSize -= 0.5;
    layout = createDocumentLayout(ctx, fields, fontSize);
  }

  let y = top;
  const section = (title: string) => {
    y += 19;
    ctx.fillStyle = muted;
    ctx.font = "600 10px Arial, sans-serif";
    ctx.fillText(title.toUpperCase(), margin, y);
    ctx.strokeStyle = border;
    ctx.beginPath();
    ctx.moveTo(margin + 135, y - 3);
    ctx.lineTo(PREVIEW_WIDTH - margin, y - 3);
    ctx.stroke();
    y += 11;
  };

  const block = (item: DocumentBlock, x: number, width: number) => {
    ctx.fillStyle = muted;
    ctx.font = "600 9px Arial, sans-serif";
    ctx.fillText(item.label.toUpperCase(), x, y + 12);
    ctx.fillStyle = foreground;
    ctx.font = `${layout.fontSize}px Arial, sans-serif`;
    item.lines.forEach((line, index) => {
      if (line) ctx.fillText(line, x, y + 32 + index * layout.lineHeight, width - 8);
    });
    ctx.strokeStyle = border;
    ctx.beginPath();
    ctx.moveTo(x, y + item.height - 3);
    ctx.lineTo(x + width, y + item.height - 3);
    ctx.stroke();
  };

  section("Patient details");
  const gap = 22;
  const columnWidth = (contentWidth - gap) / 2;
  for (const row of layout.patientRows) {
    const rowHeight = Math.max(row[0].height, row[1].height);
    block(row[0], margin, columnWidth);
    block(row[1], margin + columnWidth + gap, columnWidth);
    y += rowHeight + 8;
  }

  section("Case details");
  for (const item of layout.caseBlocks) {
    block(item, margin, contentWidth);
    y += item.height + 8;
  }

  section("History & investigations");
  for (const item of layout.historyBlocks) {
    block(item, margin, contentWidth);
    y += item.height + 6;
  }

  section("Notes");
  block(layout.noteBlock, margin, contentWidth);

  ctx.fillStyle = muted;
  ctx.font = "9px Arial, sans-serif";
  ctx.fillText("CaseSync · Pre-operative notes", margin, PREVIEW_HEIGHT - 28);
  return true;
}

function PreOpPage() {
  const [fields, setFields] = useState<PreOpFields>(EMPTY_FIELDS);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.width = PREVIEW_WIDTH;
    canvas.height = PREVIEW_HEIGHT;
    if (drawPreOpDocument(canvas, fields)) setPreview(canvas.toDataURL("image/png"));
  }, [fields]);

  function updateField<K extends keyof PreOpFields>(key: K, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function downloadImage() {
    const canvas = document.createElement("canvas");
    canvas.width = 2480;
    canvas.height = 3508;
    if (!drawPreOpDocument(canvas, fields)) {
      toast.error("The A4 image could not be prepared.");
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error("The A4 image could not be saved.");
        return;
      }
      const patient = fields.name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pre-op-${patient || "notes"}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("A4 image downloaded.");
    }, "image/png");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Link to="/start">
            <Button variant="ghost" size="sm"><ArrowLeft className="mr-1.5 h-4 w-4" /> Choose another</Button>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Pre-op notes</h1>
          <p className="text-sm text-muted-foreground">A4 portrait document</p>
        </div>
        <Button onClick={downloadImage}>
          <Download className="mr-2 h-4 w-4" /> Download A4 image
        </Button>
      </div>

      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,0.9fr)_minmax(330px,1fr)]">
        <div className="space-y-7">
          <section className="space-y-4 border-b border-border pb-6">
            <h2 className="font-semibold">Patient details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="preop-name" label="Name">
                <Input id="preop-name" value={fields.name} onChange={(event) => updateField("name", event.target.value)} />
              </FormField>
              <FormField id="preop-age" label="Age">
                <Input id="preop-age" type="number" min="0" step="1" value={fields.age} onChange={(event) => updateField("age", event.target.value)} />
              </FormField>
              <FormField id="preop-weight" label="Weight (kg)">
                <Input id="preop-weight" type="number" min="0" step="any" value={fields.weight} onChange={(event) => updateField("weight", event.target.value)} />
              </FormField>
              <FormField id="preop-ip" label="IP number">
                <Input id="preop-ip" value={fields.ipNumber} onChange={(event) => updateField("ipNumber", event.target.value)} />
              </FormField>
            </div>
          </section>

          <section className="space-y-4 border-b border-border pb-6">
            <h2 className="font-semibold">Case</h2>
            <FormField id="preop-case" label="Case">
              <Textarea id="preop-case" rows={2} value={fields.case} onChange={(event) => updateField("case", event.target.value)} />
            </FormField>
            <FormField id="preop-diagnosis" label="Diagnosis">
              <Textarea id="preop-diagnosis" rows={2} value={fields.diagnosis} onChange={(event) => updateField("diagnosis", event.target.value)} />
            </FormField>
          </section>

          <section className="space-y-4 border-b border-border pb-6">
            <h2 className="font-semibold">History & investigations</h2>
            <FormField id="preop-previous-surgery" label="Previous surgery">
              <Textarea id="preop-previous-surgery" rows={3} value={fields.previousSurgery} onChange={(event) => updateField("previousSurgery", event.target.value)} />
            </FormField>
            <FormField id="preop-echo" label="Echo findings">
              <Textarea id="preop-echo" rows={3} value={fields.echoFindings} onChange={(event) => updateField("echoFindings", event.target.value)} />
            </FormField>
            <FormField id="preop-cag" label="CAG findings">
              <Textarea id="preop-cag" rows={3} value={fields.cagFindings} onChange={(event) => updateField("cagFindings", event.target.value)} />
            </FormField>
          </section>

          <section className="space-y-4">
            <h2 className="font-semibold">Notes</h2>
            <FormField id="preop-notes" label="Notes">
              <Textarea id="preop-notes" rows={5} value={fields.notes} onChange={(event) => updateField("notes", event.target.value)} />
            </FormField>
          </section>
        </div>

        <section className="space-y-3 xl:sticky xl:top-24">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Document preview</h2>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileImage className="h-3.5 w-3.5" /> A4 · PNG</span>
          </div>
          <div className="flex justify-center rounded-md border border-border bg-muted p-3">
            {preview ? (
              <img src={preview} alt="Live A4 pre-operative notes document" className="aspect-[210/297] w-full max-w-[560px] border border-paper-border object-contain shadow-sm" />
            ) : (
              <div className="aspect-[210/297] w-full max-w-[560px] animate-pulse bg-paper" aria-label="Preparing document preview" />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function FormField({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}