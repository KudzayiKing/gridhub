import { describe, expect, it } from "vitest";
import type { DataMap } from "@/lib/tools/shared";
import type { LedgerTab } from "@/components/tools/ledger-tool";
import { resolveBusinessSelection, resolveScenarioSelection, scopeBusinessData, scopeBusinessTabs } from "@/lib/workspaces/business-scope";
import type { Business } from "@/lib/types";

const data = {
  products: [
    { id: "p-a", businessId: "biz-a", name: "A product" },
    { id: "p-b", businessId: "biz-b", name: "B product" },
  ],
  movements: [
    { id: "m-a", businessId: "biz-a", productId: "p-a" },
    { id: "m-b", businessId: "biz-b", productId: "p-b" },
    { id: "m-legacy", productId: "p-a" },
  ],
  contacts: [
    { id: "c-a", businessId: "biz-a", name: "A customer" },
    { id: "c-b", businessId: "biz-b", name: "B customer" },
  ],
  invoices: [
    { id: "i-a", businessId: "biz-a", number: "A-1" },
    { id: "i-b", businessId: "biz-b", number: "B-1" },
  ],
  payments: [
    { id: "pay-a", businessId: "biz-a", invoiceId: "i-a" },
    { id: "pay-b", businessId: "biz-b", invoiceId: "i-b" },
    { id: "pay-legacy", invoiceId: "i-a" },
  ],
  sales: [{ id: "s-a", businessId: "biz-a" }, { id: "s-b", businessId: "biz-b" }, { id: "s-old" }],
  targets: [{ id: "t-a", businessId: "biz-a" }, { id: "t-b", businessId: "biz-b" }],
  scenarios: [
    { id: "scenario-a", businessId: "biz-a", name: "A forecast" },
    { id: "scenario-b", businessId: "biz-b", name: "B forecast" },
  ],
  items: [
    { id: "item-a", businessId: "biz-a", scenarioId: "scenario-a" },
    { id: "item-b", businessId: "biz-b", scenarioId: "scenario-b" },
    { id: "item-legacy", scenarioId: "scenario-a" },
  ],
} as unknown as DataMap;

const businesses = [
  { id: "biz-a", name: "Business A", currency: "USD", fiscalYearStart: 1, deleted: false },
  { id: "biz-b", name: "Business B", currency: "EUR", fiscalYearStart: 1, deleted: false },
] as unknown as Business[];

describe("business-tool scopes", () => {
  it("defaults to All Businesses and resolves stale business and forecast selections safely", () => {
    expect(resolveBusinessSelection(businesses, null)).toBeNull();
    expect(resolveBusinessSelection(businesses, "missing")).toBeNull();
    expect(resolveBusinessSelection(businesses, "biz-a")).toBe("biz-a");
    expect(resolveScenarioSelection(data, "biz-a", "scenario-b")).toBeNull();
    expect(resolveScenarioSelection(data, null, "scenario-a")).toBe("scenario-a");
  });

  it("keeps records and same-owner legacy child history inside a selected business", () => {
    const scoped = scopeBusinessData(data, "biz-a");
    expect(scoped.products.map((row) => row.id)).toEqual(["p-a"]);
    expect(scoped.movements.map((row) => row.id)).toEqual(["m-a", "m-legacy"]);
    expect(scoped.sales.map((row) => row.id)).toEqual(["s-a"]);
    expect(scoped.invoices.map((row) => row.id)).toEqual(["i-a"]);
    expect(scoped.payments.map((row) => row.id)).toEqual(["pay-a", "pay-legacy"]);
    expect(scoped.scenarios.map((row) => row.id)).toEqual(["scenario-a"]);
    expect(scoped.items.map((row) => row.id)).toEqual(["item-a", "item-legacy"]);
  });

  it("filters tables and rejects cross-business references on save", () => {
    const tab = {
      id: "movements",
      label: "Stock movements",
      collection: "movements",
      fields: [{ key: "productId", label: "Product", type: "select", options: [{ value: "p-a", label: "A product" }] }],
    } as unknown as LedgerTab;
    const [scopedTab] = scopeBusinessTabs([tab], data, businesses, "biz-a");
    expect(scopedTab.filter?.({ id: "m-a", businessId: "biz-a" } as never)).toBe(true);
    expect(scopedTab.filter?.({ id: "m-b", businessId: "biz-b" } as never)).toBe(false);
    const prepare = scopedTab.prepareValues;
    expect(() => prepare?.({ businessId: "biz-a", productId: "p-b" })).toThrow("Choose a related record from the same business.");
    expect(prepare?.({ businessId: "biz-a", productId: "p-a" })).toMatchObject({ businessId: "biz-a", productId: "p-a" });
  });

  it("inherits the selected business currency for a new record from All Businesses", () => {
    const tab = {
      id: "sales",
      label: "Sales",
      collection: "sales",
      fields: [{ key: "currency", label: "Currency", type: "text", defaultValue: "USD" }],
    } as unknown as LedgerTab;
    const [scopedTab] = scopeBusinessTabs([tab], data, businesses, null);
    expect(scopedTab.prepareValues?.({ businessId: "biz-b", currency: "USD" })).toMatchObject({ businessId: "biz-b", currency: "EUR" });
  });
});
