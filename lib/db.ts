"use client";

import Dexie, { type Table } from "dexie";
import type { LocalRecord, OutboxEntry } from "./types";

/**
 * Local-first storage. Every tool writes here first; the sync engine drains the
 * outbox to Postgres when a session and connectivity are available.
 *
 * A record is only ever shown as "synced" after the server acknowledges it.
 */

export interface MetaRow {
  key: string;
  value: unknown;
}

class GridhubDB extends Dexie {
  records!: Table<LocalRecord, string>;
  outbox!: Table<OutboxEntry, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    // The storage key is frozen at the pre-rebrand name on purpose: it is a data contract,
    // not branding. Renaming it would orphan every local record written under the old key,
    // so the class was renamed and the key was not.
    super("gridplace");
    this.version(1).stores({
      records: "id, toolId, collection, updatedAt, dirty, [toolId+collection]",
      outbox: "id, recordId, createdAt, toolId",
      meta: "key",
    });
  }
}

let instance: GridhubDB | null = null;

export function getDB(): GridhubDB {
  if (typeof window === "undefined") {
    throw new Error("Local storage is only available in the browser.");
  }
  if (!instance) instance = new GridhubDB();
  return instance;
}

export function dbAvailable(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}
