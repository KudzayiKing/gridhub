import { describe, expect, it } from "vitest";
import { bookkeepingTabs } from "@/lib/tools/business";
import type { Business, BusinessAccount, BusinessContact, BusinessTransaction } from "@/lib/types";
import type { DataMap } from "@/lib/tools/shared";

const base = { createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z" };
const businesses: Business[] = [
  { ...base, id: "biz-us", name: "Studio", currency: "USD", fiscalYearStart: 1 },
  { ...base, id: "biz-gbp", name: "Shop", currency: "GBP", fiscalYearStart: 4 },
];
const transactions: BusinessTransaction[] = [
  { ...base, id: "t-us", businessId: "biz-us", currency: "USD", date: "2026-10-01", description: "Sale", amount: 100, type: "revenue" },
  { ...base, id: "t-gbp", businessId: "biz-gbp", currency: "GBP", date: "2026-10-02", description: "Sale", amount: 80, type: "revenue" },
  { ...base, id: "t-old", date: "2026-10-03", description: "Legacy", amount: 50, type: "expense" },
];
const accounts: BusinessAccount[] = [
  { ...base, id: "a-us", businessId: "biz-us", name: "USD bank", kind: "bank", openingBalance: 0 },
  { ...base, id: "a-gbp", businessId: "biz-gbp", name: "GBP bank", kind: "bank", openingBalance: 0 },
];
const contacts: BusinessContact[] = [
  { ...base, id: "c-us", businessId: "biz-us", name: "US customer", kind: "customer" },
];
const data: DataMap = { transactions, accounts, contacts };

describe("Bookkeeping business scope", () => {
  it("defaults to All Businesses and keeps legacy rows visible there", () => {
    const tabs = bookkeepingTabs(data, businesses);
    const visible = tabs.find((tab) => tab.id === "transactions")!;
    expect(transactions.filter(visible.filter!).map((row) => row.id)).toEqual(["t-us", "t-gbp", "t-old"]);
  });

  it("isolates records, accounts, and contacts when one business is selected", () => {
    const tabs = bookkeepingTabs(data, businesses, "biz-us");
    const tx = tabs.find((tab) => tab.id === "transactions")!;
    const account = tabs.find((tab) => tab.id === "accounts")!;
    const contact = tabs.find((tab) => tab.id === "contacts")!;
    expect(transactions.filter(tx.filter!).map((row) => row.id)).toEqual(["t-us"]);
    expect(accounts.filter(account.filter!).map((row) => row.id)).toEqual(["a-us"]);
    expect(contacts.filter(contact.filter!).map((row) => row.id)).toEqual(["c-us"]);
  });

  it("sets a new transaction's currency from its selected business", () => {
    const transaction = bookkeepingTabs(data, businesses).find((tab) => tab.id === "transactions")!;
    const prepared = transaction.prepareValues!({ businessId: "biz-gbp", amount: 12 });
    expect(prepared).toMatchObject({ businessId: "biz-gbp", currency: "GBP" });
  });

  it("rejects account references from another business", () => {
    const transaction = bookkeepingTabs(data, businesses, "biz-us").find((tab) => tab.id === "transactions")!;
    expect(() => transaction.prepareValues!({ businessId: "biz-us", accountId: "a-gbp" })).toThrow(/selected business/);
  });

  it("keeps legacy records unassigned when their edit form is saved", () => {
    const transaction = bookkeepingTabs(data, businesses).find((tab) => tab.id === "transactions")!;
    expect(transaction.prepareValues!({ businessId: "__unassigned__", description: "Legacy" }).businessId).toBeUndefined();
  });
});
