import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listProcedures, exportCsv, PROCEDURE_CATEGORIES, formatDuration } from "@/lib/procedures";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Plus, Search, Activity } from "lucide-react";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ProcLog" }, { name: "description", content: "Your procedure logbook." }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["procedures"], queryFn: listProcedures });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  const filtered = useMemo(() => {
    const items = data ?? [];
    return items.filter((p) => {
      if (cat !== "all" && p.category !== cat) return false;
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return [p.name, p.category, p.patient_ref, p.indication, p.site, p.supervisor, p.notes, p.lessons]
        .some((v) => v?.toLowerCase().includes(s));
    });
  }, [data, q, cat]);

  const stats = useMemo(() => {
    const items = data ?? [];
    const byCat: Record<string, number> = {};
    const byRole: Record<string, number> = {};
    items.forEach((p) => {
      const c = p.category || "Uncategorized";
      byCat[c] = (byCat[c] ?? 0) + 1;
      if (p.role) byRole[p.role] = (byRole[p.role] ?? 0) + 1;
    });
    const catData = Object.entries(byCat).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    return { total: items.length, byRole, catData };
  }, [data]);

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Procedures</h1>
          <p className="text-sm text-muted-foreground">Your case log, timed steps, and notes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportCsv(filtered)} disabled={!filtered.length}>
            <Download className="mr-1.5 h-4 w-4" /> Export CSV
          </Button>
          <Link to="/procedures/new"><Button><Plus className="mr-1.5 h-4 w-4" /> New</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total</CardDescription><CardTitle className="text-3xl">{stats.total}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Performed</CardDescription><CardTitle className="text-3xl">{stats.byRole["performed"] ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Assisted</CardDescription><CardTitle className="text-3xl">{stats.byRole["assisted"] ?? 0}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Observed</CardDescription><CardTitle className="text-3xl">{stats.byRole["observed"] ?? 0}</CardTitle></CardHeader></Card>
      </div>

      {stats.catData.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">By procedure type</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer>
                <BarChart data={stats.catData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={70} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} />
                  <Bar dataKey="count" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name, patient ref, notes…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {PROCEDURE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground"><Activity className="h-6 w-6" /></div>
            <div>
              <div className="font-medium">{data && data.length > 0 ? "No matches" : "No procedures yet"}</div>
              <p className="text-sm text-muted-foreground">{data && data.length > 0 ? "Try clearing filters." : "Log your first case to get started."}</p>
            </div>
            {!data?.length && <Link to="/procedures/new"><Button><Plus className="mr-1.5 h-4 w-4" /> New procedure</Button></Link>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Link key={p.id} to="/procedures/$id" params={{ id: p.id }} className="block">
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-medium">{p.name}</h3>
                      {p.role && <Badge variant="secondary" className="capitalize">{p.role}</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{format(new Date(p.performed_at), "MMM d, yyyy")}</span>
                      {p.category && <span>{p.category}</span>}
                      {p.site && <span>{p.site}</span>}
                      {p.patient_ref && <span>Pt: {p.patient_ref}</span>}
                      {p.total_duration_seconds != null && p.total_duration_seconds > 0 && <span>{formatDuration(p.total_duration_seconds)}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}