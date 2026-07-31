import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Activity, Plus, LayoutDashboard, LogOut, Users, BookMarked, BarChart3 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/theme-toggle";
import { SyncStatus } from "@/components/sync-status";
import { clearLocalData } from "@/lib/local-db";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Offline: getUser() needs the network, so fall back to the stored session
    // and let the app keep working from the on-device copy.
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) throw redirect({ to: "/auth" });
      return { user: data.session.user };
    }
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) return { user: data.user };
    const { data: sess } = await supabase.auth.getSession();
    if (sess.session?.user) return { user: sess.session.user };
    throw redirect({ to: "/auth" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await clearLocalData();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Activity className="h-4 w-4" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">CaseSync</div>
              <div className="hidden text-[10px] uppercase tracking-widest text-muted-foreground sm:block">Log · Learn · Grow</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1">
            <Link to="/dashboard">
              <Button variant={pathname === "/dashboard" ? "secondary" : "ghost"} size="sm">
                <LayoutDashboard className="mr-1.5 h-4 w-4" /> Dashboard
              </Button>
            </Link>
            <Link to="/team">
              <Button variant={pathname === "/team" ? "secondary" : "ghost"} size="sm">
                <Users className="mr-1.5 h-4 w-4" /> Team
              </Button>
            </Link>
            <Link to="/catalog">
              <Button variant={pathname === "/catalog" ? "secondary" : "ghost"} size="sm">
                <BookMarked className="mr-1.5 h-4 w-4" /> Catalog
              </Button>
            </Link>
            <Link to="/profile">
              <Button variant={pathname === "/profile" ? "secondary" : "ghost"} size="sm">
                <BarChart3 className="mr-1.5 h-4 w-4" /> Stats
              </Button>
            </Link>
            <Link to="/procedures/new">
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" /> New log
              </Button>
            </Link>
            <ThemeToggle />
            <SyncStatus />
            <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}