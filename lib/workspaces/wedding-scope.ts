import type { LedgerTab } from "../../components/tools/ledger-tool";
import type { BaseRecord, Wedding } from "../types";
import type { DataMap } from "../tools/shared";

export const WEDDING_CHILD_COLLECTIONS = ["guests", "vendors", "expenses", "payments", "tables", "tasks"] as const;

/** null represents All Weddings; stale and archived event IDs safely fall back to All. */
export function resolveWeddingSelection(weddings: Wedding[], selectedWeddingId: string | null): string | null {
  if (!selectedWeddingId) return null;
  return weddings.some((wedding) => !wedding.deleted && wedding.id === selectedWeddingId) ? selectedWeddingId : null;
}

export function scopeWeddingData(data: DataMap, weddingId: string | null): DataMap {
  if (!weddingId) return data;
  return {
    ...data,
    wedding: (data.wedding ?? []).filter((wedding) => wedding.id === weddingId),
    ...Object.fromEntries(WEDDING_CHILD_COLLECTIONS.map((collection) => [
      collection,
      (data[collection] ?? []).filter((row) => (row as BaseRecord & { weddingId?: string }).weddingId === weddingId),
    ])),
  };
}

export function filterWeddingTabs(tabs: LedgerTab[], weddingId: string | null): LedgerTab[] {
  if (!weddingId) return tabs;
  const children = new Set<string>(WEDDING_CHILD_COLLECTIONS);
  return tabs.map((tab) => {
    if (tab.collection !== "wedding" && !children.has(tab.collection)) return tab;
    return {
      ...tab,
      filter: (row: BaseRecord & { weddingId?: string }) =>
        (!tab.filter || tab.filter(row)) && (tab.collection === "wedding" ? row.id === weddingId : row.weddingId === weddingId),
    };
  });
}

export function unassignedWeddingRecordIds(data: DataMap): Record<(typeof WEDDING_CHILD_COLLECTIONS)[number], string[]> {
  const activeWeddingIds = new Set((data.wedding ?? []).filter((wedding) => !wedding.deleted).map((wedding) => wedding.id));
  return Object.fromEntries(WEDDING_CHILD_COLLECTIONS.map((collection) => [
    collection,
    (data[collection] ?? []).filter((row) => {
      if (row.deleted) return false;
      const weddingId = (row as BaseRecord & { weddingId?: string }).weddingId;
      return !weddingId || !activeWeddingIds.has(weddingId);
    }).map((row) => row.id),
  ])) as Record<(typeof WEDDING_CHILD_COLLECTIONS)[number], string[]>;
}
