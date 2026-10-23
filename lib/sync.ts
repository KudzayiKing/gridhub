"use client";

import { getDB, dbAvailable } from "./db";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "./supabase/client";
import { getMeta, setMeta } from "./store";

export type SyncPhase = "local" | "offline" | "syncing" | "synced" | "pending" | "error";

export interface SyncState {
  phase: SyncPhase;
  pending: number;
  lastSyncedAt: string | null;
  message?: string;
}

const listeners = new Set<(s: SyncState) => void>();
let state: SyncState = { phase: "local", pending: 0, lastSyncedAt: null };

export function subscribeSync(fn: (s: SyncState) => void) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

function emit(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn(state));
}

export async function pendingCount(): Promise<number> {
  if (!dbAvailable()) return 0;
  return getDB().outbox.count();
}

export async function refreshPending() {
  const pending = await pendingCount();
  const lastSyncedAt = await getMeta<string | null>("sync:last", null);
  if (!navigator.onLine) emit({ phase: "offline", pending, lastSyncedAt });
  else if (pending > 0) emit({ phase: "pending", pending, lastSyncedAt });
  else emit({ phase: isSupabaseConfigured() ? "synced" : "local", pending, lastSyncedAt });
}

interface Mutation {
  id: string;
  toolId: string;
  collection: string;
  recordId: string;
  op: "upsert" | "delete";
  payload: string;
  createdAt: string;
}

/**
 * Drains the local outbox to /api/sync.
 *
 * Guarantees:
 * - mutations are sent with their client-generated ids, so the server can dedupe
 * - an entry is only removed after the server acknowledges it
 * - records stay marked dirty until acknowledged, so nothing is silently lost
 */
export async function flushOutbox(): Promise<SyncState> {
  if (!dbAvailable()) return state;

  if (!isSupabaseConfigured()) {
    const pending = await pendingCount();
    emit({ phase: pending > 0 ? "pending" : "local", pending, message: "Cloud sync is not configured." });
    return state;
  }

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    emit({ phase: "offline", pending: await pendingCount() });
    return state;
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) return state;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    emit({ phase: "local", pending: await pendingCount(), message: "Sign in to sync." });
    return state;
  }

  const db = getDB();
  const batch = await db.outbox.orderBy("createdAt").limit(50).toArray();
  if (!batch.length) {
    emit({ phase: "synced", pending: 0, lastSyncedAt: await getMeta<string | null>("sync:last", null) });
    return state;
  }

  emit({ phase: "syncing", pending: batch.length });

  try {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        mutations: batch.map((m) => ({
          id: m.id,
          toolId: m.toolId,
          collection: m.collection,
          recordId: m.recordId,
          op: m.op,
          payload: JSON.parse(m.payload),
          createdAt: m.createdAt,
        })),
      }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Sync failed (${res.status})`);
    }

    const result = (await res.json()) as { acked?: string[]; serverTime?: string };
    const acked = new Set(result.acked ?? batch.map((m) => m.id));

    await db.transaction("rw", db.outbox, db.records, async () => {
      for (const m of batch) {
        if (!acked.has(m.id)) continue;
        await db.outbox.delete(m.id);
        const row = await db.records.get(m.recordId);
        if (row) await db.records.update(m.recordId, { dirty: 0 });
      }
    });

    const now = result.serverTime ?? new Date().toISOString();
    await setMeta("sync:last", now);
    const pending = await pendingCount();
    emit({
      phase: pending > 0 ? "pending" : "synced",
      pending,
      lastSyncedAt: now,
      message: undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";
    // Record the failure but keep the mutations queued for retry.
    await db.transaction("rw", db.outbox, async () => {
      for (const m of batch) {
        const existing = await db.outbox.get(m.id);
        if (existing) {
          await db.outbox.update(m.id, {
            attempts: existing.attempts + 1,
            lastError: message,
          });
        }
      }
    });
    emit({ phase: "error", pending: await pendingCount(), message });
  }

  return state;
}

/** Pull server changes since the stored cursor and merge them into IndexedDB. */
export async function pullChanges(): Promise<number> {
  if (!isSupabaseConfigured() || !dbAvailable()) return 0;
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return 0;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return 0;

  const cursor = await getMeta<string | null>("sync:cursor", null);
  const res = await fetch(`/api/sync?since=${encodeURIComponent(cursor ?? "")}`, {
    headers: { authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) return 0;

  const body = (await res.json()) as {
    changes?: {
      id: string;
      toolId: string;
      collection: string;
      data: Record<string, unknown>;
      updatedAt: string;
      deleted: boolean;
      version: number;
    }[];
    cursor?: string;
  };

  const db = getDB();
  let merged = 0;

  await db.transaction("rw", db.records, async () => {
    for (const change of body.changes ?? []) {
      const local = await db.records.get(change.id);
      // Never overwrite a local record with unsynced edits — that is a conflict,
      // and financial records must not be silently replaced.
      if (local && local.dirty === 1) continue;
      if (local && local.version > change.version) continue;
      await db.records.put({
        id: change.id,
        toolId: change.toolId,
        collection: change.collection,
        data: change.data,
        createdAt: local?.createdAt ?? change.updatedAt,
        updatedAt: change.updatedAt,
        deleted: change.deleted ? 1 : 0,
        version: change.version,
        dirty: 0,
      });
      merged++;
    }
  });

  if (body.cursor) await setMeta("sync:cursor", body.cursor);
  return merged;
}

/** Called on launch, reconnect, foreground and manual request. */
export async function runSync(): Promise<SyncState> {
  await refreshPending();
  await pullChanges().catch(() => 0);
  return flushOutbox();
}

export function getSyncState() {
  return state;
}
