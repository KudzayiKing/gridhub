import type { ToolId } from "@/lib/catalog";
import type { LedgerTab } from "@/components/tools/ledger-tool";
import type { DataMap } from "./shared";
import { rows } from "./shared";
import { budgetTabs, debtTabs, netWorthTabs, paycheckTabs, savingsTabs } from "./money";
import { bookkeepingTabs, cashFlowTabs, inventoryTabs, invoicingTabs, salesTabs } from "./business";
import { nutritionTabs, propertyTabs, weddingTabs } from "./life";
import { contentTabs, habitTabs, projectTabs } from "./work";

export function buildTabs(toolId: ToolId, data: DataMap): LedgerTab[] {
  switch (toolId) {
    case "budget":
      return budgetTabs(data);
    case "paycheck":
      return paycheckTabs(data);
    case "debt":
      return debtTabs(data);
    case "savings":
      return savingsTabs(data);
    case "net-worth":
      return netWorthTabs(data);
    case "bookkeeping":
      return bookkeepingTabs(data);
    case "inventory":
      return inventoryTabs(data);
    case "sales":
      return salesTabs(data);
    case "invoicing":
      return invoicingTabs(data);
    case "cash-flow":
      return cashFlowTabs(data);
    case "wedding":
      return weddingTabs(data);
    case "property":
      return propertyTabs(data);
    case "nutrition":
      return nutritionTabs(data);
    case "projects":
      return projectTabs(data);
    case "habits":
      return habitTabs(data);
    case "content":
      return contentTabs(data);
    default:
      return [];
  }
}

export interface Metric {
  label: string;
  value: string;
  hint?: string;
  icon: string;
  tone?: "neutral" | "positive" | "negative" | "warning";
}

export function metricFor(data: DataMap, collection: string): number {
  return rows(data, collection).length;
}
