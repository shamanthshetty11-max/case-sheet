import Dexie, { type Table } from "dexie";

export const SYNC_TABLES = [
  "procedures",
  "procedure_steps",
  "procedure_attachments",
  "procedure_names",
  "procedure_presets",
  "procedure_preset_fields",
  "surgical_approaches",
  "team_surgeons",
  "team_pas",
  "procedure_reexplorations",
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

export type Row = Record<string, unknown> & { id: string; user_id?: string };

export type OutboxOp = {
  key?: number;
  table: SyncTable;
  op: "upsert" | "delete";
  row_id: string;
  payload: Record<string, unknown>;
  created_at: string;
  tries: number;
  last_error?: string | null;
};

/** A file chosen while offline, waiting to be uploaded to cloud storage. */
export type PendingFile = {
  id: string;
  procedure_id: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  blob: Blob;
  created_at: string;
  uploaded: number;
};

export type MetaRow = { key: string; value: unknown };

class CaseSyncDB extends Dexie {
  procedures!: Table<Row, string>;
  procedure_steps!: Table<Row, string>;
  procedure_attachments!: Table<Row, string>;
  procedure_names!: Table<Row, string>;
  procedure_presets!: Table<Row, string>;
  procedure_preset_fields!: Table<Row, string>;
  surgical_approaches!: Table<Row, string>;
  team_surgeons!: Table<Row, string>;
  team_pas!: Table<Row, string>;
  procedure_reexplorations!: Table<Row, string>;
  outbox!: Table<OutboxOp, number>;
  files!: Table<PendingFile, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("casesync");
    this.version(1).stores({
      procedures: "id, performed_at, status, updated_at",
      procedure_steps: "id, procedure_id, order_idx",
      procedure_attachments: "id, procedure_id",
      procedure_names: "id, category, sort_order",
      procedure_presets: "id, created_at",
      procedure_preset_fields: "id, preset_id, sort_order",
      surgical_approaches: "id, sort_order",
      team_surgeons: "id, sort_order",
      team_pas: "id, sort_order",
      procedure_reexplorations: "id, procedure_id, started_at, ended_at",
      outbox: "++key, table, row_id",
      files: "id, procedure_id, uploaded",
      meta: "key",
    });
  }
}

let _db: CaseSyncDB | null = null;

/** Dexie must only be constructed in the browser (IndexedDB is absent during SSR). */
export function db(): CaseSyncDB {
  if (typeof window === "undefined") {
    throw new Error("Local database is only available in the browser");
  }
  if (!_db) _db = new CaseSyncDB();
  return _db;
}

export function hasLocalDb(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db().meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db().meta.put({ key, value });
}

export async function clearLocalData(): Promise<void> {
  if (!hasLocalDb()) return;
  const d = db();
  await Promise.all([
    ...SYNC_TABLES.map((t) => d.table(t).clear()),
    d.outbox.clear(),
    d.files.clear(),
    d.meta.clear(),
  ]);
}
