import { describe, expect, it } from "vitest";
import type { LedgerTab } from "@/components/tools/ledger-tool";
import type { Wedding } from "@/lib/types";
import type { DataMap } from "@/lib/tools/shared";
import { filterWeddingTabs, resolveWeddingSelection, scopeWeddingData, unassignedWeddingRecordIds, WEDDING_CHILD_COLLECTIONS } from "@/lib/workspaces/wedding-scope";

const wedding = (id: string, deleted = false): Wedding => ({
  id,
  createdAt: "2026-01-01",
  updatedAt: "2026-01-01",
  couple: id,
  eventDate: "2027-01-01",
  totalBudget: 1000,
  currency: "USD",
  deleted,
});
const record = (id: string, weddingId?: string) => ({ id, createdAt: "2026-01-01", updatedAt: "2026-01-01", weddingId });

describe("wedding event scope", () => {
  it("defaults to All Weddings and safely resolves stale or archived selections", () => {
    const weddings = [wedding("one"), wedding("archived", true)];
    expect(resolveWeddingSelection(weddings, null)).toBeNull();
    expect(resolveWeddingSelection(weddings, "missing")).toBeNull();
    expect(resolveWeddingSelection(weddings, "archived")).toBeNull();
    expect(resolveWeddingSelection(weddings, "one")).toBe("one");
  });

  it("scopes every child collection without mutating legacy or other-event data", () => {
    const data = {
      wedding: [wedding("one"), wedding("two")],
      ...Object.fromEntries(WEDDING_CHILD_COLLECTIONS.map((collection) => [collection, [
        record(`${collection}-one`, "one"),
        record(`${collection}-two`, "two"),
        record(`${collection}-legacy`),
      ]])),
    } as unknown as DataMap;
    expect(scopeWeddingData(data, null)).toBe(data);
    const scoped = scopeWeddingData(data, "one");
    expect(scoped.wedding).toEqual([wedding("one")]);
    for (const collection of WEDDING_CHILD_COLLECTIONS) expect(scoped[collection]).toEqual([record(`${collection}-one`, "one")]);
    expect(data.guests).toHaveLength(3);
  });

  it("composes selected-event filters with existing tab filters", () => {
    const tabs = [
      { id: "guests", label: "Guests", collection: "guests", filter: (row: { id: string }) => row.id !== "hidden" },
      { id: "tasks", label: "Tasks", collection: "tasks" },
    ] as unknown as LedgerTab[];
    const filtered = filterWeddingTabs(tabs, "one");
    expect(filtered[0].filter?.({ id: "visible", weddingId: "one" } as never)).toBe(true);
    expect(filtered[0].filter?.({ id: "other", weddingId: "two" } as never)).toBe(false);
    expect(filtered[0].filter?.({ id: "hidden", weddingId: "one" } as never)).toBe(false);
    expect(filtered[1].filter?.({ id: "task", weddingId: "one" } as never)).toBe(true);
  });

  it("identifies unassigned active legacy rows without changing them", () => {
    const data = {
      wedding: [wedding("one"), wedding("archived", true)],
      guests: [record("old"), record("assigned", "one"), record("stale", "archived"), { ...record("deleted"), deleted: true }],
    } as unknown as DataMap;
    const unassigned = unassignedWeddingRecordIds(data);
    expect(unassigned.guests).toEqual(["old", "stale"]);
    expect((data.guests[0] as { weddingId?: string }).weddingId).toBeUndefined();
  });
});
