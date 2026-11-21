import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProcedureForm } from "@/components/procedure-form";

export const Route = createFileRoute("/_authenticated/procedures/new")({
  head: () => ({ meta: [
    { title: "New case log — CaseSync" },
    { name: "description", content: "Create a new surgical procedure log in CaseSync." },
    { property: "og:title", content: "New case log — CaseSync" },
    { property: "og:description", content: "Create a new surgical procedure log in CaseSync." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: NewProcedure,
});

function NewProcedure() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New log</h1>
        <p className="text-sm text-muted-foreground">Fill what you need. Only date and name are required.</p>
      </div>
      <ProcedureForm onSaved={(id) => navigate({ to: "/procedures/$id", params: { id } })} />
    </div>
  );
}