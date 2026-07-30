import { supabase } from "@/integrations/supabase/client";
import {
  SYNC_TABLES,
  db,
  getMeta,
  hasLocalDb,
  nowIso,
  setMeta,
  type OutboxOp,
  type Row,
  type SyncTable,
} from "./local-db";

export type SyncState = {
  online: boolean;
  syncing: boolean;
  pending: number;
  lastSyncedAt: string | null;
  error: string | null;
};

let state: SyncState = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  syncing: false,
  pending: 0,
  lastSyncedAt: null,
  error: null,
};

const listeners = new Set<() => void>();

export function getSyncState(): SyncState {
  return state;
}

export function subscribeSync(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

async function refreshPending() {
  if (!hasLocalDb()) return;
  const [ops, files] = await Promise.all([
    db().outbox.count(),
    db().files.where("uploaded").equals(0).count(),
  ]);
  set({ pending: ops + files });
}

// ---------- local repository helpers ----------

export async function localList<T>(table: SyncTable): Promise<T[]> {
  if (!hasLocalDb()) return [];
  const rows = await db().table(table).toArray();
  return rows.filter((r) => !r.deleted_at) as T[];
}

export async function localGet<T>(table: SyncTable, id: string): Promise<T | undefined> {
  if (!hasLocalDb()) return undefined;
  const row = await db().table(table).get(id);
  return row && !row.deleted_at ? (row as T) : undefined;
}

/** Write locally and queue the change for the cloud. */
export async function localUpsert(table: SyncTable, row: Row): Promise<Row> {
  const full = { ...row, updated_at: nowIso() } as Row;
  await db().table(table).put(full);
  await db().outbox.add({
    table,
    op: "upsert",
    row_id: full.id,
    payload: full as Record<string, unknown>,
    created_at: nowIso(),
    tries: 0,
  });
  void refreshPending();
  void kick();
  return full;
}

export async function localPatch(table: SyncTable, id: string, patch: Record<string, unknown>): Promise<Row> {
  const existing = (await db().table(table).get(id)) as Row | undefined;
  if (!existing) throw new Error("Record not found on this device");
  return localUpsert(table, { ...existing, ...patch, id });
}

/** Soft-delete: hidden locally, and the deletion propagates to other devices. */
export async function localDelete(table: SyncTable, id: string): Promise<void> {
  const stamp = nowIso();
  await db().table(table).delete(id);
  await db().outbox.add({
    table,
    op: "delete",
    row_id: id,
    payload: { id, deleted_at: stamp },
    created_at: stamp,
    tries: 0,
  });
  void refreshPending();
  void kick();
}

export async function queueFileUpload(file: {
  id: string;
  procedure_id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  blob: Blob;
}) {
  await db().files.put({ ...file, created_at: nowIso(), uploaded: 0 });
  void refreshPending();
  void kick();
}

// ---------- push ----------

async function pushOutbox(): Promise<void> {
  const ops = (await db().outbox.orderBy("key").toArray()) as OutboxOp[];
  for (const op of ops) {
    try {
      if (op.op === "upsert") {
        const payload = { ...op.payload };
        delete (payload as Record<string, unknown>).deleted_at;
        const { error } = await supabase.from(op.table).upsert(payload as never);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from(op.table)
          .update({ deleted_at: op.payload.deleted_at } as never)
          .eq("id", op.row_id);
        if (error) throw error;
      }
      await db().outbox.delete(op.key!);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Network failures keep the op queued for a later attempt; server rejections
      // (bad row, gone) are dropped after several tries so the queue never wedges.
      const tries = op.tries + 1;
      if (tries >= 5) {
        await db().outbox.delete(op.key!);
      } else {
        await db().outbox.update(op.key!, { tries, last_error: message });
      }
      if (!navigator.onLine) throw err;
    }
  }

  const pendingFiles = await db().files.where("uploaded").equals(0).toArray();
  for (const f of pendingFiles) {
    const { error } = await supabase.storage
      .from("procedure-files")
      .upload(f.storage_path, f.blob, { upsert: true, contentType: f.mime_type ?? undefined });
    if (error && !/already exists/i.test(error.message)) continue;
    await db().files.update(f.id, { uploaded: 1 });
  }
}

// ---------- pull ----------

async function pullTable(table: SyncTable, since: string | null): Promise<void> {
  let query = supabase.from(table).select("*");
  if (since) query = query.gt("updated_at", since);
  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  if (!rows.length) return;
  const toDelete = rows.filter((r) => r.deleted_at).map((r) => r.id);
  const toPut = rows.filter((r) => !r.deleted_at);
  if (toDelete.length) await db().table(table).bulkDelete(toDelete);
  if (toPut.length) await db().table(table).bulkPut(toPut);
}

let running: Promise<void> | null = null;

export async function syncNow(): Promise<void> {
  if (!hasLocalDb()) return;
  if (running) return running;
  running = (async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) return;
    set({ syncing: true, error: null });
    try {
      await pushOutbox();
      const since = (await getMeta<string>("lastPull")) ?? null;
      const startedAt = nowIso();
      for (const table of SYNC_TABLES) {
        await pullTable(table, since);
      }
      await setMeta("lastPull", startedAt);
      set({ lastSyncedAt: startedAt, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      await refreshPending();
      set({ syncing: false });
      running = null;
    }
  })();
  return running;
}

function kick() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  return syncNow();
}

let started = false;

export function startSync(): void {
  if (started || !hasLocalDb()) return;
  started = true;
  void refreshPending();
  void syncNow();
  window.addEventListener("online", () => {
    set({ online: true });
    void syncNow();
  });
  window.addEventListener("offline", () => set({ online: false }));
  window.setInterval(() => {
    if (navigator.onLine) void syncNow();
  }, 60_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && navigator.onLine) void syncNow();
  });
}

/** Called after sign-in so a fresh device downloads everything. */
export async function resetAndPull(): Promise<void> {
  if (!hasLocalDb()) return;
  await setMeta("lastPull", null);
  await syncNow();
}
