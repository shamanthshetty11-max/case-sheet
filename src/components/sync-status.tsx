import { useEffect, useSyncExternalStore } from "react";
import { Cloud, CloudOff, RefreshCw, Check } from "lucide-react";
import { getSyncState, startSync, subscribeSync, syncNow } from "@/lib/sync";

const serverState = {
  online: true,
  syncing: false,
  pending: 0,
  lastSyncedAt: null as string | null,
  error: null as string | null,
};

export function SyncStatus() {
  useEffect(() => {
    startSync();
  }, []);

  const state = useSyncExternalStore(subscribeSync, getSyncState, () => serverState);

  const label = !state.online
    ? state.pending > 0
      ? `Offline · ${state.pending} to sync`
      : "Offline"
    : state.syncing
      ? "Syncing…"
      : state.pending > 0
        ? `${state.pending} to sync`
        : "Synced";

  const Icon = !state.online ? CloudOff : state.syncing ? RefreshCw : state.pending > 0 ? Cloud : Check;

  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      title={state.error ?? (state.lastSyncedAt ? `Last synced ${new Date(state.lastSyncedAt).toLocaleTimeString()}` : "Sync now")}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
        !state.online
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : state.pending > 0
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      <Icon className={`h-3.5 w-3.5 ${state.syncing ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
