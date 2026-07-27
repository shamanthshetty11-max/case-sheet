import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProcedureForm } from "@/components/procedure-form";

export const Route = createFileRoute("/_authenticated/procedures/new")({
  head: () => ({ meta: [{ title: "New procedure — CaseSync" }, { name: "description", content: "Log a new procedure." }] }),
  component: NewProcedure,
});

function NewProcedure() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New procedure</h1>
        <p className="text-sm text-muted-foreground">Fill what you need. Only date and name are required.</p>
      </div>
      <ProcedureForm onSaved={(id) => navigate({ to: "/procedures/$id", params: { id } })} />
    </div>
  );
}