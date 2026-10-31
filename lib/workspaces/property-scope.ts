import type { LedgerTab } from "../../components/tools/ledger-tool";
import type { BaseRecord, Property, PropertyBooking, PropertyExpense, PropertyMaintenance, PropertyUnit } from "../types";
import type { DataMap } from "../tools/shared";

/** null represents All Properties. Invalid, stale, and archived IDs safely fall back to it. */
export function resolvePropertySelection(properties: Property[], selectedPropertyId: string | null): string | null {
  if (!selectedPropertyId) return null;
  return properties.some((property) => !property.deleted && property.id === selectedPropertyId) ? selectedPropertyId : null;
}

/** Apply one selected property to every existing child collection without mutating records. */
export function scopePropertyData(data: DataMap, propertyId: string | null): DataMap {
  if (!propertyId) return data;
  return {
    ...data,
    properties: (data.properties ?? []).filter((property) => property.id === propertyId),
    units: ((data.units ?? []) as PropertyUnit[]).filter((unit) => unit.propertyId === propertyId),
    bookings: ((data.bookings ?? []) as PropertyBooking[]).filter((booking) => booking.propertyId === propertyId),
    expenses: ((data.expenses ?? []) as PropertyExpense[]).filter((expense) => expense.propertyId === propertyId),
    maintenance: ((data.maintenance ?? []) as PropertyMaintenance[]).filter((item) => item.propertyId === propertyId),
  };
}

export function filterPropertyTabs(tabs: LedgerTab[], propertyId: string | null): LedgerTab[] {
  if (!propertyId) return tabs;
  const childCollections = new Set(["units", "bookings", "expenses", "maintenance"]);
  return tabs.map((tab) => {
    const filter = (row: BaseRecord & { propertyId?: string }) =>
      (!tab.filter || tab.filter(row)) && (tab.collection === "properties" ? row.id === propertyId : !childCollections.has(tab.collection) || row.propertyId === propertyId);
    return ["properties", ...childCollections].includes(tab.collection) ? { ...tab, filter } : tab;
  });
}
