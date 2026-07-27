import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Activity, ClipboardList, Timer, BarChart3 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CaseSync — Log. Learn. Grow." },
      { name: "description", content: "CaseSync — a private procedure logbook built for medical professionals. Log every case, time each step, keep clinical notes." },
      { property: "og:title", content: "CaseSync — Log. Learn. Grow." },
      { property: "og:description", content: "A private procedure logbook built for medical professionals. Log. Learn. Grow." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
      else setChecked(true);
    });
  }, [navigate]);

  if (!checked) return <div className="min-h-screen bg-background" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">CaseSync</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link to="/auth">
              <Button variant="ghost">Sign in</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="mb-4 inline-block rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            Built for medical professionals
          </p>
          <h1 className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
            Log. Learn. Grow.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            CaseSync is a private procedure logbook for medical professionals — capture every case, time each step, and keep clinical notes ready for credentialing.
          </p>
          <div className="mt-8 flex gap-3">
            <Link to="/auth">
              <Button size="lg">Get started</Button>
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-6 sm:grid-cols-3">
          <Feature icon={<ClipboardList className="h-5 w-5" />} title="Structured cases" desc="Diagnosis, surgical approach, surgeon, assistants, complications, and notes." />
          <Feature icon={<Timer className="h-5 w-5" />} title="Timed steps" desc="Add the steps that matter for each case and record how long each took." />
          <Feature icon={<BarChart3 className="h-5 w-5" />} title="Stats & export" desc="See counts by procedure and month. Export a CSV for your logbook." />
        </div>
      </main>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground">{icon}</div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}