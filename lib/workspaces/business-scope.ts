import type { LedgerTab } from "../../components/tools/ledger-tool";
import type { FormField } from "../../components/data/record-form";
import type { BaseRecord, Business, CashScenario } from "../types";
import type { DataMap } from "../tools/shared";

const BUSINESS_COLLECTIONS = ["products", "movements", "sales", "targets", "contacts", "invoices", "payments", "items", "scenarios"] as const;

export function resolveBusinessSelection(businesses: Business[], selectedId: string | null): string | null {
  return selectedId && businesses.some((business) => business.id === selectedId && !business.deleted) ? selectedId : null;
}

export function resolveScenarioSelection(data: DataMap, businessId: string | null, selectedId: string | null): string | null {
  if (!selectedId) return null;
  const scenario = (data.scenarios ?? []).find((row) => row.id === selectedId && !row.deleted) as CashScenario | undefined;
  return scenario && (!businessId || scenario.businessId === businessId) ? selectedId : null;
}

/** Scope business-tool records while retaining unassigned legacy rows in All Businesses. */
export function scopeBusinessData(data: DataMap, businessId: string | null, scenarioId: string | null = null): DataMap {
  let result: DataMap = data;
  if (businessId) {
    const scoped = new Set(BUSINESS_COLLECTIONS);
    const products = (data.products ?? []).filter((row) => (row as BaseRecord & { businessId?: string }).businessId === businessId);
    const productIds = new Set(products.map((row) => row.id));
    const invoices = (data.invoices ?? []).filter((row) => (row as BaseRecord & { businessId?: string }).businessId === businessId);
    const invoiceIds = new Set(invoices.map((row) => row.id));
    const scenarios = (data.scenarios ?? []).filter((row) => (row as CashScenario).businessId === businessId);
    const scenarioIds = new Set(scenarios.map((row) => row.id));
    result = { ...data };
    for (const collection of scoped) {
      result[collection] = (data[collection] ?? []).filter((row) => (row as BaseRecord & { businessId?: string }).businessId === businessId);
    }
    // Historical movements/payments are safely attributable through their existing parent IDs.
    result.movements = (data.movements ?? []).filter((row) => {
      const movement = row as BaseRecord & { businessId?: string; productId?: string };
      return movement.businessId === businessId || (!movement.businessId && Boolean(movement.productId && productIds.has(movement.productId)));
    });
    result.payments = (data.payments ?? []).filter((row) => {
      const payment = row as BaseRecord & { businessId?: string; invoiceId?: string };
      return payment.businessId === businessId || (!payment.businessId && Boolean(payment.invoiceId && invoiceIds.has(payment.invoiceId)));
    });
    result.items = (data.items ?? []).filter((row) => {
      const item = row as BaseRecord & { businessId?: string; scenarioId?: string };
      return item.businessId === businessId || (!item.businessId && Boolean(item.scenarioId && scenarioIds.has(item.scenarioId)));
    });
  }

  if (scenarioId) {
    result = {
      ...result,
      scenarios: (result.scenarios ?? []).filter((row) => row.id === scenarioId),
      items: (result.items ?? []).filter((row) => (row as BaseRecord & { scenarioId?: string }).scenarioId === scenarioId),
    };
  }
  return result;
}

/** Inject business ownership and same-business reference checks into the existing ledger tabs. */
export function scopeBusinessTabs(tabs: LedgerTab[], data: DataMap, businesses: Business[], businessId: string | null, scenarioId: string | null = null): LedgerTab[] {
  const activeBusinesses = businesses.filter((business) => !business.deleted);
  const activeBusiness = activeBusinesses.find((business) => business.id === businessId);
  const businessOptions = [
    { value: "__unassigned__", label: "Unassigned legacy record", raw: true, disabled: true },
    ...activeBusinesses.filter((business) => !businessId || business.id === businessId).map((business) => ({ value: business.id, label: business.name, raw: true })),
  ];
  const requiredCollections = new Set(BUSINESS_COLLECTIONS);
  const referenceCollections: Record<string, string> = {
    productId: "products",
    supplierId: "contacts",
    customerId: "contacts",
    contactId: "contacts",
    invoiceId: "invoices",
    scenarioId: "scenarios",
  };

  return tabs.map((tab) => {
    if (!requiredCollections.has(tab.collection as typeof BUSINESS_COLLECTIONS[number])) return tab;
    const oldPrepare = tab.prepareValues;
    const businessField: FormField = {
      key: "businessId",
      label: "Business",
      type: "select",
      required: true,
      options: businessOptions,
      defaultValue: businessId ?? "",
      help: "Choose which business owns this record.",
    };
    const baseFields = tab.fields.some((field) => field.key === "businessId") ? tab.fields : [businessField, ...tab.fields];
    const fields = baseFields.map((field) => field.key === "businessId"
      ? { ...field, options: businessOptions, defaultValue: businessId ?? field.defaultValue }
      : field.key === "scenarioId"
        ? { ...field, defaultValue: scenarioId ?? field.defaultValue }
        : field.key === "currency" && activeBusiness
          ? { ...field, defaultValue: activeBusiness.currency }
          : field);
    const scopedProductIds = new Set((data.products ?? []).filter((row) => (row as BaseRecord & { businessId?: string }).businessId === businessId).map((row) => row.id));
    const scopedInvoiceIds = new Set((data.invoices ?? []).filter((row) => (row as BaseRecord & { businessId?: string }).businessId === businessId).map((row) => row.id));
    const scopedScenarioIds = new Set((data.scenarios ?? []).filter((row) => (row as BaseRecord & { businessId?: string }).businessId === businessId).map((row) => row.id));
    const belongsToScope = (row: BaseRecord) => {
      if (!businessId) return true;
      const record = row as BaseRecord & { businessId?: string; productId?: string; invoiceId?: string; scenarioId?: string };
      if (record.businessId === businessId) return true;
      if (tab.collection === "movements") return !record.businessId && Boolean(record.productId && scopedProductIds.has(record.productId));
      if (tab.collection === "payments") return !record.businessId && Boolean(record.invoiceId && scopedInvoiceIds.has(record.invoiceId));
      if (tab.collection === "items") return !record.businessId && Boolean(record.scenarioId && scopedScenarioIds.has(record.scenarioId));
      return false;
    };
    return {
      ...tab,
      fields,
      filter: (row: BaseRecord) => (!tab.filter || tab.filter(row)) && belongsToScope(row),
      legacyScopeField: "businessId",
      prepareValues: (rawValues, editing) => {
        const values = oldPrepare?.(rawValues, editing) ?? rawValues;
        const rawBusinessId = values.businessId;
        const recordBusinessId = rawBusinessId === "__unassigned__" ? undefined : String(rawBusinessId ?? "");
        const legacyEdit = rawBusinessId === "__unassigned__";
        if (businessId && recordBusinessId && recordBusinessId !== businessId) throw new Error("Choose a record from the selected business.");
        if (!legacyEdit && !activeBusinesses.some((business) => business.id === recordBusinessId)) throw new Error("Choose a valid business for this record.");
        for (const [key, collection] of Object.entries(referenceCollections)) {
          const id = values[key];
          if (typeof id !== "string" || !id) continue;
          const reference = (data[collection] ?? []).find((row) => row.id === id) as (BaseRecord & { businessId?: string }) | undefined;
          const unchangedLegacyReference = legacyEdit && editing && (editing as BaseRecord & Record<string, unknown>)[key] === id;
          if (!reference || (reference.businessId !== recordBusinessId && !unchangedLegacyReference)) throw new Error("Choose a related record from the same business.");
        }
        const preparedValues = { ...values, businessId: recordBusinessId };
        const recordBusiness = activeBusinesses.find((business) => business.id === recordBusinessId);
        if (recordBusiness && "currency" in preparedValues && (!editing || (editing as BaseRecord & { businessId?: string }).businessId !== recordBusinessId)) {
          preparedValues.currency = recordBusiness.currency;
        }
        return preparedValues;
      },
    };
  });
}
