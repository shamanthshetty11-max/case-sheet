import { createFileRoute, useNavigate, useParams, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProcedure, deleteProcedure } from "@/lib/procedures";
import { ProcedureForm } from "@/components/procedure-form";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/procedures/$id")({
  head: () => ({ meta: [{ title: "Procedure — CaseSync" }, { name: "description", content: "Procedure detail." }] }),
  component: ProcedureDetail,
});

function ProcedureDetail() {
  const { id } = useParams({ from: "/_authenticated/procedures/$id" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["procedure", id], queryFn: () => getProcedure(id) });

  async function handleDelete() {
    if (!confirm("Delete this procedure? This cannot be undone.")) return;
    try {
      await deleteProcedure(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
      return;
    }
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["procedures"] });
    navigate({ to: "/dashboard" });
  }

  if (isLoading || !data) return <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/dashboard"><Button variant="ghost" size="sm"><ArrowLeft className="mr-1.5 h-4 w-4" /> Back</Button></Link>
        <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive"><Trash2 className="mr-1.5 h-4 w-4" /> Delete</Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{data.procedure.name}</h1>
        <p className="text-sm text-muted-foreground">Edit any field and save.</p>
      </div>
      <ProcedureForm
        initial={data.procedure}
        initialSteps={data.steps}
        initialAttachments={data.attachments}
        procedureId={id}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["procedure", id] }); qc.invalidateQueries({ queryKey: ["procedures"] }); }}
      />
    </div>
  );
}