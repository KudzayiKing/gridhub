import { describe, expect, it } from "vitest";
import type { LedgerTab } from "@/components/tools/ledger-tool";
import type { Property } from "@/lib/types";
import { filterPropertyTabs, resolvePropertySelection, scopePropertyData } from "@/lib/workspaces/property-scope";

const property = (id: string, deleted = false): Property => ({
  id, createdAt: "2026-01-01", updatedAt: "2026-01-01", name: id,
  currency: "USD", context: "personal", deleted,
});
const record = (id: string, propertyId: string) => ({ id, createdAt: "2026-01-01", updatedAt: "2026-01-01", propertyId });

describe("property selection scope", () => {
  it("defaults to All Properties and resolves invalid or archived IDs safely", () => {
    const properties = [property("home"), property("archived", true)];
    expect(resolvePropertySelection(properties, null)).toBeNull();
    expect(resolvePropertySelection(properties, "missing")).toBeNull();
    expect(resolvePropertySelection(properties, "archived")).toBeNull();
    expect(resolvePropertySelection(properties, "home")).toBe("home");
  });

  it("filters every property child collection without modifying the source data", () => {
    const data = {
      properties: [property("flat"), property("house")],
      units: [record("u1", "flat"), record("u2", "house")],
      bookings: [record("b1", "flat"), record("b2", "house")],
      expenses: [record("e1", "flat"), record("e2", "house")],
      maintenance: [record("m1", "flat"), record("m2", "house")],
    };
    expect(scopePropertyData(data, null)).toBe(data);
    expect(scopePropertyData(data, "flat")).toMatchObject({
      properties: [{ id: "flat" }], units: [{ id: "u1" }], bookings: [{ id: "b1" }],
      expenses: [{ id: "e1" }], maintenance: [{ id: "m1" }],
    });
    expect(data.properties).toHaveLength(2);
  });

  it("composes the selected property filter with an existing table filter", () => {
    const tabs = [{ id: "bookings", label: "Bookings", collection: "bookings", filter: (row: { id: string }) => row.id !== "hidden" }] as unknown as LedgerTab[];
    const [tab] = filterPropertyTabs(tabs, "flat");
    expect(tab.filter?.({ id: "visible", propertyId: "flat" } as never)).toBe(true);
    expect(tab.filter?.({ id: "other", propertyId: "house" } as never)).toBe(false);
    expect(tab.filter?.({ id: "hidden", propertyId: "flat" } as never)).toBe(false);
  });
});
