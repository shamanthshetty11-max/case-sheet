import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import {
  addTeamPA,
  addTeamSurgeon,
  deleteTeamPA,
  deleteTeamSurgeon,
  listTeamPAs,
  listTeamSurgeons,
  withDr,
  type TeamMember,
} from "@/lib/procedures";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({ meta: [{ title: "Team — CaseSync" }, { name: "description", content: "Save your team of surgeons and physician assistants." }] }),
  component: TeamPage,
});

function TeamPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your team</h1>
        <p className="text-sm text-muted-foreground">Save the surgeons and physician assistants you work with so they're a click away when logging a case.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <TeamList
          title="Surgeons"
          description='Names are shown with a "Dr." prefix automatically.'
          icon={<UserRound className="h-4 w-4" />}
          queryKey={["team_surgeons"]}
          list={listTeamSurgeons}
          add={addTeamSurgeon}
          remove={deleteTeamSurgeon}
          renderName={(n) => withDr(n)}
          placeholder="e.g. Smith or Jane Smith"
        />
        <TeamList
          title="Physician assistants"
          description="These names show up in the PA dropdown on the case form."
          icon={<Users className="h-4 w-4" />}
          queryKey={["team_pas"]}
          list={listTeamPAs}
          add={addTeamPA}
          remove={deleteTeamPA}
          renderName={(n) => n}
          placeholder="e.g. Alex Kim"
        />
      </div>
    </div>
  );
}

function TeamList(props: {
  title: string;
  description: string;
  icon: React.ReactNode;
  queryKey: string[];
  list: () => Promise<TeamMember[]>;
  add: (name: string) => Promise<TeamMember>;
  remove: (id: string) => Promise<void>;
  renderName: (n: string) => string;
  placeholder: string;
}) {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: props.queryKey, queryFn: props.list });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      await props.add(n);
      setName("");
      qc.invalidateQueries({ queryKey: props.queryKey });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  }
  async function rm(id: string) {
    try {
      await props.remove(id);
      qc.invalidateQueries({ queryKey: props.queryKey });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  }
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary text-secondary-foreground">{props.icon}</div>
          <CardTitle className="text-base">{props.title}</CardTitle>
        </div>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={submit} className="flex gap-2">
          <Input placeholder={props.placeholder} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={busy}><Plus className="mr-1.5 h-4 w-4" /> Add</Button>
        </form>
        <div className="space-y-1.5">
          {(data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No one added yet.</p>
          ) : (
            (data ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <span>{props.renderName(m.name)}</span>
                <Button type="button" size="icon" variant="ghost" onClick={() => rm(m.id)} aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}