import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listProcedures, exportCsv, PROCEDURE_CATEGORIES, formatDuration, scrubIn, scrubOut, getInProgressProcedure } from "@/lib/procedures";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Plus, Search, Activity, CalendarDays, TrendingUp, Clock, Timer, PlayCircle, StopCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { format, isSameDay, isSameMonth, startOfMonth, startOfWeek, subDays } from "date-fns";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import type { Procedure } from "@/lib/procedures";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CaseSync" }, { name: "description", content: "Your CaseSync procedure logbook." }] }),
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
      return [p.name, p.category, p.patient_ref, p.indication, p.site, p.surgeon, p.assistant_surgeon, p.notes]
        .some((v) => v?.toLowerCase().includes(s));
    });
  }, [data, q, cat]);

  const stats = useMemo(() => {
    const items = data ?? [];
    const byCat: Record<string, number> = {};
    items.forEach((p) => {
      const c = p.category || "Uncategorized";
      byCat[c] = (byCat[c] ?? 0) + 1;
    });
    const catData = Object.entries(byCat).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const now = new Date();
    const monthCount = items.filter((p) => isSameMonth(new Date(p.performed_at), now)).length;
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekCount = items.filter((p) => new Date(p.performed_at) >= weekStart).length;
    const last30 = items.filter((p) => new Date(p.performed_at) >= subDays(now, 30)).length;
    return { total: items.length, catData, monthCount, weekCount, last30 };
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
          <Link to="/procedures/new"><Button><Plus className="mr-1.5 h-4 w-4" /> New log</Button></Link>
        </div>
      </div>

      <LiveCaseCard />

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardDescription>Total</CardDescription><CardTitle className="text-3xl">{stats.total}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>This month</CardDescription><CardTitle className="text-3xl">{stats.monthCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>This week</CardDescription><CardTitle className="text-3xl">{stats.weekCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader className="pb-2"><CardDescription>Last 30 days</CardDescription><CardTitle className="text-3xl">{stats.last30}</CardTitle></CardHeader></Card>
      </div>

      <CasesCalendar items={data ?? []} />

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
                      {p.category && <Badge variant="secondary">{p.category}</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{format(new Date(p.performed_at), "MMM d, yyyy")}</span>
                      {p.site && <span>{p.site}</span>}
                      {p.surgeon && <span>Dr. {p.surgeon.replace(/^dr\.?\s+/i, "")}</span>}
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

function CasesCalendar({ items }: { items: Procedure[] }) {
  const [month, setMonth] = useState<Date>(startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | undefined>(new Date());

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of items) {
      const key = format(new Date(p.performed_at), "yyyy-MM-dd");
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const monthCount = useMemo(
    () => items.filter((p) => isSameMonth(new Date(p.performed_at), month)).length,
    [items, month],
  );
  const weekCount = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return items.filter((p) => new Date(p.performed_at) >= start).length;
  }, [items]);
  const busiest = useMemo(() => {
    let best: { key: string; n: number } | null = null;
    for (const [key, n] of counts) {
      const d = new Date(key);
      if (!isSameMonth(d, month)) continue;
      if (!best || n > best.n) best = { key, n };
    }
    return best;
  }, [counts, month]);
  const last30 = useMemo(() => {
    const from = subDays(new Date(), 30);
    return items.filter((p) => new Date(p.performed_at) >= from).length;
  }, [items]);

  const daysWithCases = useMemo(() => Array.from(counts.keys()).map((k) => new Date(k)), [counts]);
  const selectedList = useMemo(() => {
    if (!selected) return [];
    return items
      .filter((p) => isSameDay(new Date(p.performed_at), selected))
      .sort((a, b) => +new Date(b.performed_at) - +new Date(a.performed_at));
  }, [items, selected]);

  function DayWithCount(props: DayButtonProps) {
    const { day, modifiers, className, ...rest } = props;
    const key = format(day.date, "yyyy-MM-dd");
    const n = counts.get(key) ?? 0;
    const isSelected = selected && isSameDay(day.date, selected);
    const isToday = isSameDay(day.date, new Date());
    return (
      <button
        {...rest}
        className={`relative flex aspect-square h-auto w-full flex-col items-center justify-center gap-0.5 rounded-md text-sm transition-colors hover:bg-accent ${
          isSelected ? "bg-primary text-primary-foreground hover:bg-primary" : ""
        } ${!isSelected && isToday ? "ring-1 ring-primary/40" : ""} ${modifiers.outside ? "opacity-40" : ""} ${className ?? ""}`}
      >
        <span className="leading-none">{day.date.getDate()}</span>
        {n > 0 && (
          <span
            className={`rounded-full px-1.5 text-[10px] font-medium leading-4 ${
              isSelected ? "bg-primary-foreground text-primary" : "bg-primary/15 text-primary"
            }`}
          >
            {n}
          </span>
        )}
      </button>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Case calendar</CardTitle>
        </div>
        <div className="text-xs text-muted-foreground">Numbers show cases logged that day</div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MiniStat icon={<CalendarDays className="h-3.5 w-3.5" />} label={format(month, "MMM")} value={monthCount} />
          <MiniStat icon={<Clock className="h-3.5 w-3.5" />} label="This wk" value={weekCount} />
          <MiniStat icon={<TrendingUp className="h-3.5 w-3.5" />} label="30d" value={last30} />
          <MiniStat icon={<Activity className="h-3.5 w-3.5" />} label="Total" value={items.length} />
        </div>
        <div className="rounded-lg border border-border p-2">
          <DayPicker
            mode="single"
            month={month}
            onMonthChange={setMonth}
            selected={selected}
            onSelect={setSelected}
            weekStartsOn={1}
            showOutsideDays
            modifiers={{ hasCases: daysWithCases }}
            className="w-full"
            classNames={{
              months: "flex flex-col gap-4",
              month: "w-full space-y-3",
              month_caption: "flex items-center justify-center py-1 text-sm font-medium",
              caption_label: "text-sm font-medium",
              nav: "flex items-center justify-between px-1",
              button_previous: "h-7 w-7 rounded-md hover:bg-accent inline-flex items-center justify-center",
              button_next: "h-7 w-7 rounded-md hover:bg-accent inline-flex items-center justify-center",
              weekdays: "grid grid-cols-7",
              weekday: "text-[11px] font-normal text-muted-foreground py-1 text-center",
              week: "grid grid-cols-7 gap-1 mt-1",
              day: "p-0",
            }}
            components={{ DayButton: DayWithCount }}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {busiest && (
            <div className="rounded-md border border-border bg-secondary/40 p-3 text-xs">
              <div className="text-muted-foreground">Busiest day this month</div>
              <div className="mt-0.5 font-medium">
                {format(new Date(busiest.key), "EEE, MMM d")} — {busiest.n} case{busiest.n === 1 ? "" : "s"}
              </div>
            </div>
          )}
          <div className="rounded-md border border-border p-3">
            <div className="mb-2 text-xs font-medium text-muted-foreground">
              {selected ? format(selected, "EEE, MMM d") : "Pick a day"}
            </div>
            {selectedList.length === 0 ? (
              <div className="text-xs text-muted-foreground">No cases on this day.</div>
            ) : (
              <ul className="space-y-1.5">
                {selectedList.map((p) => (
                  <li key={p.id}>
                    <Link to="/procedures/$id" params={{ id: p.id }} className="block truncate rounded px-2 py-1 text-sm hover:bg-accent">
                      <span className="font-medium">{p.name}</span>
                      {p.category && <span className="ml-2 text-xs text-muted-foreground">{p.category}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">{icon}{label}</div>
      <div className="text-lg font-semibold leading-tight">{value}</div>
    </div>
  );
}

function LiveCaseCard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: live } = useQuery({ queryKey: ["live_procedure"], queryFn: getInProgressProcedure, refetchInterval: 15000 });
  const [form, setForm] = useState({ patient_name: "", ip_number: "", diagnosis: "", name: "", category: "" });
  const [busy, setBusy] = useState(false);

  async function onScrubIn(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Procedure name is required"); return; }
    setBusy(true);
    try {
      await scrubIn({ ...form, name: form.name.trim() });
      qc.invalidateQueries({ queryKey: ["live_procedure"] });
      qc.invalidateQueries({ queryKey: ["procedures"] });
      setForm({ patient_name: "", ip_number: "", diagnosis: "", name: "", category: "" });
      toast.success("Scrubbed in — timer started");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  }
  async function onScrubOut() {
    if (!live) return;
    setBusy(true);
    try {
      await scrubOut(live.id);
      qc.invalidateQueries({ queryKey: ["live_procedure"] });
      qc.invalidateQueries({ queryKey: ["procedures"] });
      toast.success("Scrubbed out — add the rest of the details");
      navigate({ to: "/procedures/$id", params: { id: live.id } });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (live) {
    return (
      <Card className="border-primary/40 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-primary animate-pulse" />
            <CardTitle className="text-base">Case in progress</CardTitle>
          </div>
          <LiveTimer since={live.scrub_in_at ?? live.created_at} />
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-sm">
            <div className="font-medium">{live.name}{live.category ? ` · ${live.category}` : ""}</div>
            <div className="text-xs text-muted-foreground">
              {[live.patient_name && `Pt: ${live.patient_name}`, live.ip_number && `IP: ${live.ip_number}`, live.indication && `Dx: ${live.indication}`].filter(Boolean).join(" · ") || "No pre-op details"}
            </div>
          </div>
          <Button onClick={onScrubOut} disabled={busy}><StopCircle className="mr-1.5 h-4 w-4" /> Scrub out</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <PlayCircle className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Quick scrub-in</CardTitle>
        </div>
        <div className="text-xs text-muted-foreground">Pre-op essentials · we'll time the case</div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onScrubIn} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5"><Label className="text-xs">Patient name</Label><Input value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">IP number</Label><Input value={form.ip_number} onChange={(e) => setForm({ ...form, ip_number: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Diagnosis</Label><Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Select value={form.category} onValueChange={(x) => setForm({ ...form, category: x })}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>{PROCEDURE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs">Procedure name *</Label><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="sm:col-span-2 lg:col-span-5 flex justify-end">
            <Button type="submit" disabled={busy}><PlayCircle className="mr-1.5 h-4 w-4" /> Scrub in</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function LiveTimer({ since }: { since: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - new Date(since).getTime()) / 1000));
  return <span className="font-mono text-sm text-primary">{formatDuration(elapsed)}</span>;
}