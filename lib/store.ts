"use client";

import { useEffect, useState } from "react";
import { getDB, dbAvailable } from "./db";
import type { BaseRecord, LocalRecord } from "./types";
import { uid } from "./utils";

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
  const rows = await getDB()
    .records.where("[toolId+collection]")
    .equals([toolId, collection])
    .toArray();
  return rows
    .filter((r) => !r.deleted)
    .map((r) => r.data as unknown as T)
    .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
}

export async function listAll(toolId: string): Promise<LocalRecord[]> {
  if (!dbAvailable()) return [];
  return getDB().records.where("toolId").equals(toolId).toArray();
}

export async function getRecord<T extends BaseRecord>(
  id: string,
): Promise<T | null> {
  if (!dbAvailable()) return null;
  const row = await getDB().records.get(id);
  return row && !row.deleted ? (row.data as unknown as T) : null;
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

async function writeRecord<T extends BaseRecord>(
  toolId: string,
  collection: string,
  record: T,
  op: "upsert" | "delete",
) {
  if (!dbAvailable()) throw new Error("Local storage unavailable");
  const db = getDB();
  const now = new Date().toISOString();
  const row: LocalRecord = {
    id: record.id,
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
    await db.records.put(row);
    await db.outbox.add({
      id: uid("mut"),
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
    return () => {
      alive = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
