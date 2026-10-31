"use client";

import { useEffect, useState } from "react";
import { getDB, dbAvailable } from "./db";
import type { BaseRecord, LocalRecord } from "./types";
import { uid } from "./utils";
import { belongsToWorkspaceScope, getWorkspaceScope, subscribeWorkspaceScope } from "./workspaces/context";

/* ==========================================================================
   Change notification — a tiny pub/sub so every mounted table refreshes
   immediately after a local write, including cross-component writes.
   ========================================================================== */

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();
const globalListeners = new Set<Listener>();

function key(toolId: string, collection: string) {
  return `${toolId}:${collection}`;
}

export function subscribe(toolId: string, collection: string, fn: Listener): () => void {
  const k = key(toolId, collection);
  if (!listeners.has(k)) listeners.set(k, new Set());
  listeners.get(k)!.add(fn);
  return () => listeners.get(k)?.delete(fn);
}

export function subscribeAll(fn: Listener): () => void {
  globalListeners.add(fn);
  return () => globalListeners.delete(fn);
}

function notify(toolId: string, collection: string) {
  listeners.get(key(toolId, collection))?.forEach((fn) => fn());
  globalListeners.forEach((fn) => fn());
}

/* ==========================================================================
   Repository
   ========================================================================== */

export type NewRecord<T> = Omit<T, keyof BaseRecord> & Partial<Pick<BaseRecord, "id">>;

export async function listRecords<T extends BaseRecord>(
  toolId: string,
  collection: string,
): Promise<T[]> {
  if (!dbAvailable()) return [];
  const { workspaceId, ownerUserId } = getWorkspaceScope();
  const rows = await getDB().records
    .where("[workspaceId+toolId+collection]")
    .equals([workspaceId, toolId, collection])
    .toArray();
  return rows
    .filter((r) => !r.deleted && belongsToWorkspaceScope(r, { workspaceId, ownerUserId }))
    .map((r) => r.data as unknown as T)
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

/** List only archived rows for an explicit restore UI, within the active workspace. */
export async function listArchivedRecords<T extends BaseRecord>(toolId: string, collection: string): Promise<T[]> {
  if (!dbAvailable()) return [];
  const { workspaceId, ownerUserId } = getWorkspaceScope();
  const rows = await getDB().records
    .where("[workspaceId+toolId+collection]")
    .equals([workspaceId, toolId, collection])
    .toArray();
  return rows
    .filter((row) => Boolean(row.deleted) && belongsToWorkspaceScope(row, { workspaceId, ownerUserId }))
    .map((row) => ({ ...(row.data as unknown as T), deleted: true }))
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

export async function listAll(toolId: string): Promise<LocalRecord[]> {
  if (!dbAvailable()) return [];
  const scope = getWorkspaceScope();
  return getDB().records.where("toolId").equals(toolId).filter(
    (row) => belongsToWorkspaceScope(row, scope),
  ).toArray();
}

export async function getRecord<T extends BaseRecord>(
  id: string,
): Promise<T | null> {
  if (!dbAvailable()) return null;
  const row = await getDB().records.get(id);
  const scope = getWorkspaceScope();
  return row && belongsToWorkspaceScope(row, scope) && !row.deleted
    ? (row.data as unknown as T)
    : null;
}

export async function createRecord<T extends BaseRecord>(
  toolId: string,
  collection: string,
  data: NewRecord<T>,
): Promise<T> {
  const now = new Date().toISOString();
  const record = {
    ...data,
    id: (data as { id?: string }).id ?? uid(collection.slice(0, 3)),
    createdAt: now,
    updatedAt: now,
    version: 1,
  } as unknown as T;

  await writeRecord(toolId, collection, record, "upsert");
  return record;
}

export async function updateRecord<T extends BaseRecord>(
  toolId: string,
  collection: string,
  id: string,
  patch: Partial<T>,
): Promise<T | null> {
  const existing = await getRecord<T>(id);
  if (!existing) return null;
  const next = {
    ...existing,
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
    version: (existing.version ?? 1) + 1,
  } as T;
  await writeRecord(toolId, collection, next, "upsert");
  return next;
}

/** Soft delete: the row stays for sync/audit, but disappears from the UI. */
export async function removeRecord(toolId: string, collection: string, id: string): Promise<void> {
  const existing = await getRecord(id);
  if (!existing) return;
  await writeRecord(toolId, collection, { ...existing, updatedAt: new Date().toISOString() } as BaseRecord, "delete");
}

/** Restore an archived row without bypassing its workspace ownership boundary. */
export async function restoreRecord<T extends BaseRecord>(toolId: string, collection: string, id: string): Promise<T | null> {
  if (!dbAvailable()) return null;
  const row = await getDB().records.get(id);
  const scope = getWorkspaceScope();
  if (!row || !row.deleted || !belongsToWorkspaceScope(row, scope) || row.toolId !== toolId || row.collection !== collection) return null;
  const existing = row.data as unknown as T;
  const restored = { ...existing, id, deleted: false, updatedAt: new Date().toISOString(), version: (existing.version ?? row.version ?? 1) + 1 } as T;
  await writeRecord(toolId, collection, restored, "upsert");
  return restored;
}

async function writeRecord<T extends BaseRecord>(
  toolId: string,
  collection: string,
  record: T,
  op: "upsert" | "delete",
) {
  if (!dbAvailable()) throw new Error("Local storage unavailable");
  const db = getDB();
  const scope = getWorkspaceScope();
  const now = new Date().toISOString();
  const row: LocalRecord = {
    id: record.id,
    workspaceId: scope.workspaceId,
    ownerUserId: scope.ownerUserId,
    toolId,
    collection,
    data: record as unknown as Record<string, unknown>,
    createdAt: record.createdAt ?? now,
    updatedAt: now,
    deleted: op === "delete" ? 1 : 0,
    version: record.version ?? 1,
    dirty: 1,
  };

  await db.transaction("rw", db.records, db.outbox, async () => {
    const previous = await db.records.get(record.id);
    if (previous && !belongsToWorkspaceScope(previous, scope)) {
      throw new Error("This record ID already belongs to another workspace. Choose a new record ID.");
    }
    await db.records.put(row);
    await db.outbox.add({
      id: uid("mut"),
      workspaceId: scope.workspaceId,
      ownerUserId: scope.ownerUserId,
      toolId,
      collection,
      recordId: record.id,
      op,
      payload: JSON.stringify(record),
      createdAt: now,
      attempts: 0,
    });
  });

  notify(toolId, collection);
}

export async function bulkCreate<T extends BaseRecord>(
  toolId: string,
  collection: string,
  items: NewRecord<T>[],
): Promise<T[]> {
  const out: T[] = [];
  for (const item of items) out.push(await createRecord<T>(toolId, collection, item));
  return out;
}

/** Replace every record in a collection — used by sample-data loaders and imports. */
export async function replaceCollection<T extends BaseRecord>(
  toolId: string,
  collection: string,
  items: NewRecord<T>[],
): Promise<void> {
  const existing = await listRecords<T>(toolId, collection);
  for (const row of existing) await removeRecord(toolId, collection, row.id);
  for (const item of items) await createRecord<T>(toolId, collection, item);
}

/* ==========================================================================
   React bindings
   ========================================================================== */

export interface CollectionState<T> {
  rows: T[];
  loading: boolean;
  reload: () => Promise<void>;
  add: (data: NewRecord<T>) => Promise<T>;
  update: (id: string, patch: Partial<T>) => Promise<T | null>;
  remove: (id: string) => Promise<void>;
  replaceAll: (items: NewRecord<T>[]) => Promise<void>;
}

export function useCollection<T extends BaseRecord>(
  toolId: string,
  collection: string,
): CollectionState<T> {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    const next = await listRecords<T>(toolId, collection);
    setRows(next);
    setLoading(false);
  };

  useEffect(() => {
    let alive = true;
    const load = () => {
      listRecords<T>(toolId, collection)
        .then((next) => {
          if (alive) {
            setRows(next);
            setLoading(false);
          }
        })
        .catch(() => {
          if (alive) setLoading(false);
        });
    };
    load();
    const unsub = subscribe(toolId, collection, load);
    const unsubScope = subscribeWorkspaceScope(load);
    return () => {
      alive = false;
      unsub();
      unsubScope();
    };
  }, [toolId, collection]);

  return {
    rows,
    loading,
    reload,
    add: (data) => createRecord<T>(toolId, collection, data),
    update: (id, patch) => updateRecord<T>(toolId, collection, id, patch),
    remove: (id) => removeRecord(toolId, collection, id),
    replaceAll: (items) => replaceCollection<T>(toolId, collection, items),
  };
}

/** Count pre-workspace rows that have not been attributed to an account/workspace. */
export async function countLegacyLocalRows(): Promise<{ records: number; mutations: number }> {
  if (!dbAvailable()) return { records: 0, mutations: 0 };
  const db = getDB();
  const [records, mutations] = await Promise.all([
    db.records.filter((row) => !row.workspaceId).count(),
    db.outbox.filter((row) => !row.workspaceId).count(),
  ]);
  return { records, mutations };
}

/**
 * Explicitly associate pre-workspace local rows with the workspace selected by the user.
 * No data is copied or discarded; all pending mutations are retained and scoped together.
 */
export async function attachLegacyLocalRows(workspaceId: string, ownerUserId: string | null): Promise<number> {
  if (!dbAvailable()) return 0;
  const db = getDB();
  let count = 0;
  await db.transaction("rw", db.records, db.outbox, async () => {
    const legacyRows = await db.records.filter((row) => !row.workspaceId).toArray();
    const legacyMutations = await db.outbox.filter((row) => !row.workspaceId).toArray();
    for (const row of legacyRows) {
      const collision = await db.records.get(row.id);
      if (collision && collision.workspaceId) {
        throw new Error("A legacy record conflicts with a record already in this workspace. No legacy rows were moved.");
      }
      await db.records.update(row.id, { workspaceId, ownerUserId });
    }
    for (const mutation of legacyMutations) {
      await db.outbox.update(mutation.id, { workspaceId, ownerUserId });
    }
    count = legacyRows.length;
  });
  return count;
}

/** Bind a device-only workspace to its authenticated server identity after explicit user action. */
export async function claimLocalWorkspaceRows(workspaceId: string, ownerUserId: string): Promise<number> {
  if (!dbAvailable()) return 0;
  const db = getDB();
  let count = 0;
  await db.transaction("rw", db.records, db.outbox, async () => {
    const rows = await db.records.where("workspaceId").equals(workspaceId).filter((row) => row.ownerUserId == null).toArray();
    const mutations = await db.outbox.where("workspaceId").equals(workspaceId).filter((row) => row.ownerUserId == null).toArray();
    for (const row of rows) await db.records.update(row.id, { ownerUserId });
    for (const mutation of mutations) await db.outbox.update(mutation.id, { ownerUserId });
    count = rows.length;
  });
  return count;
}

/* ==========================================================================
   Preferences (workspace-level, stored in meta so it survives sign-out)
   ========================================================================== */

export async function getMeta<T>(k: string, fallback: T): Promise<T> {
  if (!dbAvailable()) return fallback;
  const row = await getDB().meta.get(k);
  return (row?.value as T) ?? fallback;
}

export async function setMeta(k: string, value: unknown): Promise<void> {
  if (!dbAvailable()) return;
  await getDB().meta.put({ key: k, value });
  globalListeners.forEach((fn) => fn());
}

export function useMeta<T>(k: string, fallback: T): [T, (v: T) => Promise<void>, boolean] {
  const [value, setValue] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () => {
      getMeta<T>(k, fallback).then((v) => {
        if (alive) {
          setValue(v);
          setLoading(false);
        }
      });
    };
    load();
    const unsub = subscribeAll(load);
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);

  return [
    value,
    async (v: T) => {
      setValue(v);
      await setMeta(k, v);
    },
    loading,
  ];
}
