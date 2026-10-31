import type { ToolId } from "@/lib/catalog";
import type { LedgerTab } from "@/components/tools/ledger-tool";
import type { Business } from "@/lib/types";
import type { DataMap } from "./shared";
import { rows } from "./shared";
import { scopeBusinessTabs } from "@/lib/workspaces/business-scope";
import { budgetTabs, debtTabs, netWorthTabs, paycheckTabs, savingsTabs } from "./money";
import { bookkeepingTabs, cashFlowTabs, inventoryTabs, invoicingTabs, salesTabs } from "./business";
import { nutritionTabs, propertyTabs, weddingTabs } from "./life";
import { contentTabs, habitTabs, projectTabs } from "./work";

export interface ToolTabContext {
  contentPlanId?: string | null;
  businesses?: Business[];
  selectedBusinessId?: string | null;
  selectedScenarioId?: string | null;
  selectedWeddingId?: string | null;
}

export function buildTabs(toolId: ToolId, data: DataMap, context: ToolTabContext = {}): LedgerTab[] {
  const businessScoped = (tabs: LedgerTab[]) => scopeBusinessTabs(tabs, data, context.businesses ?? [], context.selectedBusinessId ?? null, context.selectedScenarioId ?? null);
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
      return businessScoped(inventoryTabs(data, context.businesses ?? [], context.selectedBusinessId ?? null));
    case "sales":
      return businessScoped(salesTabs(data, context.businesses ?? [], context.selectedBusinessId ?? null));
    case "invoicing":
      return businessScoped(invoicingTabs(data, context.businesses ?? [], context.selectedBusinessId ?? null));
    case "cash-flow":
      return businessScoped(cashFlowTabs(data));
    case "wedding":
      return weddingTabs(data, context.selectedWeddingId ?? null);
    case "property":
      return propertyTabs(data, context.businesses ?? []);
    case "nutrition":
      return nutritionTabs(data);
    case "projects":
      return projectTabs(data);
    case "habits":
      return habitTabs(data);
    case "content":
      return contentTabs(data, context.contentPlanId);
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
