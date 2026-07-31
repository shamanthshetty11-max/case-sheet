import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  listProcedures,
  listReexplorations,
  type Procedure,
  type Reexploration,
} from "@/lib/procedures";
import { localList } from "@/lib/sync";
import { Activity, Clock, CalendarDays, Flame, Download, TrendingUp } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "Profile & stats · CaseSync" },
      { name: "description", content: "Your surgical logbook stats: total cases, hours in case, averages, categories and team breakdowns." },
      { property: "og:title", content: "Profile & stats · CaseSync" },
      { property: "og:description", content: "Total cases, hours in case, averages and team breakdowns from your CaseSync logbook." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type RangeKey = "month" | "90d" | "year" | "all";
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "90d", label: "90 days" },
  { key: "year", label: "This year" },
  { key: "all", label: "All time" },
];

function rangeStart(key: RangeKey): Date | null {
  const now = new Date();
  if (key === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (key === "90d") return new Date(now.getTime() - 90 * 86400000);
  if (key === "year") return new Date(now.getFullYear(), 0, 1);
  return null;
}

/** Seconds spent in a case: explicit total, else scrub in/out span. */
function caseSeconds(p: Procedure): number {
  if (p.total_duration_seconds && p.total_duration_seconds > 0) return p.total_duration_seconds;
  if (p.scrub_in_at && p.scrub_out_at) {
    const s = (new Date(p.scrub_out_at).getTime() - new Date(p.scrub_in_at).getTime()) / 1000;
    return s > 0 ? Math.round(s) : 0;
  }
  return 0;
}

function hm(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function ProfilePage() {
  const [range, setRange] = useState<RangeKey>("all");

  const proceduresQ = useQuery({ queryKey: ["procedures"], queryFn: listProcedures });
  const reexQ = useQuery({
    queryKey: ["procedure_reexplorations", "all"],
    queryFn: () => localList<Reexploration>("procedure_reexplorations"),
  });
  const userQ = useQuery({
    queryKey: ["auth_user"],
    queryFn: async () => (await supabase.auth.getSession()).data.session?.user ?? null,
  });

  const all = proceduresQ.data ?? [];
  const reex = reexQ.data ?? [];

  const procedures = useMemo(() => {
    const from = rangeStart(range);
    if (!from) return all;
    return all.filter((p) => new Date(p.performed_at) >= from);
  }, [all, range]);

  const stats = useMemo(() => {
    const durations = procedures.map(caseSeconds);
    const timed = durations.filter((d) => d > 0);
    const totalSeconds = durations.reduce((a, b) => a + b, 0);

    const byDay = new Map<string, number>();
    for (const p of procedures) byDay.set(dayKey(p.performed_at), (byDay.get(dayKey(p.performed_at)) ?? 0) + 1);
    const activeDays = byDay.size;
    const busiest = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

    const sorted = [...procedures].sort((a, b) => a.performed_at.localeCompare(b.performed_at));
    const firstDate = sorted[0] ? new Date(sorted[0].performed_at) : null;
    const spanDays = firstDate ? Math.max(1, Math.ceil((Date.now() - firstDate.getTime()) / 86400000)) : 1;

    // Current streak of consecutive days with at least one case.
    let streak = 0;
    const cursor = new Date();
    for (;;) {
      const key = cursor.toISOString().slice(0, 10);
      if (byDay.has(key)) { streak++; cursor.setDate(cursor.getDate() - 1); continue; }
      if (streak === 0 && key === new Date().toISOString().slice(0, 10)) { cursor.setDate(cursor.getDate() - 1); continue; }
      break;
    }

    const longest = timed.length ? Math.max(...timed) : 0;
    const shortest = timed.length ? Math.min(...timed) : 0;

    const inRangeIds = new Set(procedures.map((p) => p.id));
    const reexInRange = reex.filter((r) => inRangeIds.has(r.procedure_id));
    const reexCases = new Set(reexInRange.map((r) => r.procedure_id)).size;
    const reexSeconds = reexInRange.reduce((a, r) => a + (r.duration_seconds ?? 0), 0);

    return {
      total: procedures.length,
      totalSeconds,
      avgSeconds: timed.length ? Math.round(totalSeconds / timed.length) : 0,
      perDay: procedures.length / spanDays,
      perWeek: (procedures.length / spanDays) * 7,
      perMonth: (procedures.length / spanDays) * 30,
      activeDays,
      busiest,
      streak,
      longest,
      shortest,
      reexCases,
      reexSeconds,
    };
  }, [procedures, reex]);

  const byCategory = useMemo(() => groupBy(procedures, (p) => p.category || "Uncategorised"), [procedures]);
  const byName = useMemo(() => groupBy(procedures, (p) => p.name || "Unnamed"), [procedures]);
  const bySurgeon = useMemo(
    () => groupBy(procedures.filter((p) => p.surgeon), (p) => p.surgeon as string),
    [procedures],
  );
  const byPa = useMemo(() => {
    const map = new Map<string, { count: number; seconds: number }>();
    for (const p of procedures) {
      for (const pa of p.pa_names ?? []) {
        const cur = map.get(pa) ?? { count: 0, seconds: 0 };
        cur.count += 1;
        cur.seconds += caseSeconds(p);
        map.set(pa, cur);
      }
    }
    return [...map.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.count - a.count);
  }, [procedures]);

  const monthly = useMemo(() => {
    const map = new Map<string, { cases: number; hours: number }>();
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      map.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, { cases: 0, hours: 0 });
    }
    for (const p of all) {
      const d = new Date(p.performed_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const cur = map.get(k);
      if (!cur) continue;
      cur.cases += 1;
      cur.hours += caseSeconds(p) / 3600;
    }
    return [...map.entries()].map(([k, v]) => ({
      month: new Date(`${k}-01T00:00:00`).toLocaleString(undefined, { month: "short" }),
      cases: v.cases,
      hours: Math.round(v.hours * 10) / 10,
    }));
  }, [all]);

  const milestones = useMemo(() => {
    const totalCases = all.length;
    const totalHours = all.reduce((a, p) => a + caseSeconds(p), 0) / 3600;
    const cardiac = all.filter((p) => p.category === "Cardiac surgery").length;
    const next = (v: number, steps: number[]) => steps.find((s) => v < s) ?? steps[steps.length - 1];
    return [
      { label: "Total cases", value: totalCases, target: next(totalCases, [25, 50, 100, 250, 500, 1000]), unit: "cases" },
      { label: "Hours in case", value: Math.round(totalHours), target: next(totalHours, [50, 100, 250, 500, 1000, 2500]), unit: "h" },
      { label: "Cardiac cases", value: cardiac, target: next(cardiac, [10, 25, 50, 100, 250, 500]), unit: "cases" },
    ];
  }, [all]);

  function exportStats() {
    const rows: string[][] = [
      ["metric", "value"],
      ["range", RANGES.find((r) => r.key === range)!.label],
      ["total cases", String(stats.total)],
      ["hours in case", hm(stats.totalSeconds)],
      ["average case", hm(stats.avgSeconds)],
      ["cases per week", stats.perWeek.toFixed(1)],
      ["cases per month", stats.perMonth.toFixed(1)],
      ["active days", String(stats.activeDays)],
      ["longest case", hm(stats.longest)],
      ["shortest case", hm(stats.shortest)],
      ["re-explored cases", String(stats.reexCases)],
      ["re-exploration time", hm(stats.reexSeconds)],
      [],
      ["category", "cases", "hours"],
      ...byCategory.map((c) => [c.key, String(c.count), hm(c.seconds)]),
      [],
      ["surgeon", "cases", "hours"],
      ...bySurgeon.map((c) => [c.key, String(c.count), hm(c.seconds)]),
    ];
    const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `casesync-stats-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Profile & stats</h1>
          <p className="text-sm text-muted-foreground">{userQ.data?.email ?? "Signed in"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {RANGES.map((r) => (
            <Button key={r.key} size="sm" variant={range === r.key ? "secondary" : "ghost"} onClick={() => setRange(r.key)}>
              {r.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={exportStats}>
            <Download className="mr-1.5 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={<Activity className="h-4 w-4" />} label="Total cases" value={String(stats.total)} />
        <Stat icon={<Clock className="h-4 w-4" />} label="Hours in case" value={hm(stats.totalSeconds)} />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="Average case" value={hm(stats.avgSeconds)} />
        <Stat icon={<CalendarDays className="h-4 w-4" />} label="Cases / week" value={stats.perWeek.toFixed(1)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Cases / month" value={stats.perMonth.toFixed(1)} />
        <Stat label="Active days" value={String(stats.activeDays)} />
        <Stat icon={<Flame className="h-4 w-4" />} label="Current streak" value={`${stats.streak} day${stats.streak === 1 ? "" : "s"}`} />
        <Stat
          label="Busiest day"
          value={stats.busiest ? `${stats.busiest[1]} cases` : "—"}
          sub={stats.busiest ? new Date(stats.busiest[0]).toLocaleDateString() : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Last 12 months</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} className="text-xs" />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} className="text-xs" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="cases" name="Cases" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="hours" name="Hours" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Milestones</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {milestones.map((m) => (
              <div key={m.label} className="space-y-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span>{m.label}</span>
                  <span className="text-muted-foreground">{m.value} / {m.target}{m.unit === "h" ? "h" : ""}</span>
                </div>
                <Progress value={Math.min(100, (m.value / m.target) * 100)} />
              </div>
            ))}
            <div className="rounded-md border border-border p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Longest case</span><span>{hm(stats.longest)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Shortest case</span><span>{hm(stats.shortest)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Re-explored</span><span>{stats.reexCases} · {hm(stats.reexSeconds)}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RankCard title="By category" rows={byCategory} />
        <RankCard title="Top procedures" rows={byName.slice(0, 8)} />
        <RankCard title="Surgeons" rows={bySurgeon.slice(0, 8)} />
        <RankCard title="Physician assistants" rows={byPa.slice(0, 8)} />
      </div>
    </div>
  );
}

function groupBy(procedures: Procedure[], keyOf: (p: Procedure) => string) {
  const map = new Map<string, { count: number; seconds: number }>();
  for (const p of procedures) {
    const k = keyOf(p);
    const cur = map.get(k) ?? { count: 0, seconds: 0 };
    cur.count += 1;
    cur.seconds += caseSeconds(p);
    map.set(k, cur);
  }
  return [...map.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.count - a.count);
}

function Stat({ icon, label, value, sub }: { icon?: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          {icon} {label}
        </div>
        <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
        {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

function RankCard({ title, rows }: { title: string; rows: { key: string; count: number; seconds: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No cases yet.</p> : null}
        {rows.map((r) => (
          <div key={r.key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate">{r.key}</span>
              <span className="shrink-0 text-muted-foreground">{r.count} · {hm(r.seconds)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(r.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
