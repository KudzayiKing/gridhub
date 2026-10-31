"use client";

import * as React from "react";
import { toast } from "sonner";
import { LedgerTool, Panel } from "./ledger-tool";
import { Card, CompactMetric, MetricCard, Badge, EmptyState } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import {
  ChartContainer,
  ChartEmptyState,
  ChartPeriodSelector,
  MonthlyComparisonChart,
  CategoryBreakdownChart,
  BudgetVsActualChart,
  TrendChart,
  HorizontalRankingChart,
} from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { AnimatedTabs } from "@/components/ui/animated-tabs";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { useToolData } from "@/lib/use-tool-data";
import { listArchivedRecords, restoreRecord, subscribe, updateRecord, useCollection } from "@/lib/store";
import { subscribeWorkspaceScope } from "@/lib/workspaces/context";
import { buildTabs } from "@/lib/tools";
import { rows } from "@/lib/tools/shared";
import { usePrefs } from "@/components/providers";
import { useI18n } from "@/lib/i18n";
import { formatMoney, formatPercent, round2 } from "@/lib/money";
import { downloadFile, formatDate } from "@/lib/utils";
import {
  currentMonth,
  currentYear,
  budgetSummary,
  simulateDebt,
  debtTotals,
  savingsTotals,
  netWorthSummary,
  paycheckSummary,
} from "@/lib/calc/money";
import { bookkeepingSummary, inventorySummary, salesSummary, invoicingSummary, forecastCashFlow } from "@/lib/calc/business";
import { weddingSummary, propertySummary, dailyTotals, macroSplit } from "@/lib/calc/life";
import { habitsOverview, projectProgress, contentSummary, isScheduled, KANBAN_COLUMNS } from "@/lib/calc/work";
import {
  monthlyComparisonData,
  categorySlices,
  annualBudgetVsActual,
  annualBudgetAllocation,
  cashFlowTrend,
  topExpenseCategories,
  budgetReportCSV,
} from "@/lib/reporting/budget";
import { useToolPeriod, yearOptions } from "@/lib/use-tool-period";
import { PinChartButton } from "@/lib/chart-widgets";
import { PaycheckDashboard } from "./paycheck-dashboard";
import { DebtDashboard } from "./debt-dashboard";
import { SavingsDashboard } from "./savings-dashboard";
import { NetWorthDashboard } from "./net-worth-dashboard";
import { OperationsDashboard, OperationsHero } from "./operations-dashboard";
import { BookkeepingBusinesses } from "./bookkeeping-businesses";
import { BusinessScopeControl } from "./business-scope-control";
import { filterProjectTabs, resolveProjectSelection, scopeProjectData } from "@/lib/workspaces/project-scope";
import { filterContentTabs, resolveContentScope, scopeContentData, type ContentScope } from "@/lib/workspaces/content-scope";
import { resolveBusinessSelection, resolveScenarioSelection, scopeBusinessData } from "@/lib/workspaces/business-scope";
import { filterPropertyTabs, resolvePropertySelection, scopePropertyData } from "@/lib/workspaces/property-scope";
import { filterWeddingTabs, resolveWeddingSelection, scopeWeddingData, unassignedWeddingRecordIds } from "@/lib/workspaces/wedding-scope";
import type { ToolId } from "@/lib/catalog";
import type { DataMap } from "@/lib/tools/shared";
import type { BaseRecord } from "@/lib/types";
import type {
  CashForecastItem,
  CashScenario,
  Business,
  ContentPost,
  ContentPlan,
  ChannelAccount,
  ContentPublication,
  Debt,
  GoalMovement,
  Habit,
  HabitCompletion,
  Invoice,
  MoneyBudget,
  MoneyCategory,
  MoneyTransaction,
  NutritionLog,
  Paycheck,
  PaycheckAllocation,
  Payment,
  Project,
  Property,
  PropertyBooking,
  PropertyExpense,
  PropertyMaintenance,
  PropertyUnit,
  Sale,
  SalesTarget,
  SavingsGoal,
  Task,
  WeddingExpense,
  WeddingGuest,
  WeddingPayment,
  WeddingTable,
  WeddingTask,
  WeddingVendor,
  Wedding,
  BusinessTransaction,
  BusinessProduct,
  InventoryMovement,
  NetWorthItem,
  Holding,
  ValuationSnapshot,
} from "@/lib/types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
const metricSum = (values: number[]) => round2(values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0));
function addDaysISO(date: string, days: number) {
  const value = new Date(date + "T00:00:00");
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

/** "2026-10" -> "October 2026". Falls back to the raw string if it can't be parsed. */
function monthLong(period: string): string {
  const d = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return period;
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** Chart drill-down state. `month` and `categoryId` are independent so a user can, for example,
 *  open October and then filter its transactions to a single category. */
export interface DrillState {
  month?: string;
  day?: string;
  categoryId?: string;
  categoryName?: string;
}

/** Apply the active drill-down to the budget tool's transactions tab so the underlying ledger
 *  reflects exactly what the chart is showing (spec #21). Other tools are untouched. */
function applyDrill(tabs: ReturnType<typeof buildTabs>, drill: DrillState, toolId: ToolId) {
  if (toolId !== "budget") return tabs;
  if (!drill.month && !drill.day && !drill.categoryId) return tabs;
  const label = [
    drill.month ? monthLong(drill.month) : null,
    drill.day ? new Date(`${drill.day}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null,
    drill.categoryId && drill.categoryId !== "__other__" ? `Category: ${drill.categoryName ?? "—"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return tabs.map((t) => {
    if (t.id !== "transactions") return t;
    const filter = (row: BaseRecord) => {
      if (drill.month && !String((row as { date?: string }).date ?? "").startsWith(drill.month)) return false;
      if (drill.day && String((row as { date?: string }).date ?? "") !== drill.day) return false;
      if (drill.categoryId && drill.categoryId !== "__other__" && (row as { categoryId?: string }).categoryId !== drill.categoryId)
        return false;
      return true;
    };
    return { ...t, filter, filterLabel: label };
  });
}

export function ToolView({ toolId }: { toolId: ToolId }) {
  const { data, loading } = useToolData(toolId);
  const businessCollection = useCollection<Business>("bookkeeping", "businesses");
  const { prefs } = usePrefs();
  const { t } = useI18n();
  const currency = prefs.currency || "USD";

  const [drill, setDrill] = React.useState<DrillState>({});
  const [requestedTab, setRequestedTab] = React.useState<string | undefined>();
  const [requestedAdd, setRequestedAdd] = React.useState<{ tabId: string; id: number } | null>(null);
  const [projectSelection, setProjectSelection] = React.useState<{ toolId: ToolId; projectId: string | null }>({ toolId, projectId: null });
  const [contentSelection, setContentSelection] = React.useState<{ toolId: ToolId; scope: ContentScope }>({ toolId, scope: null });
  const [businessSelection, setBusinessSelection] = React.useState<{ toolId: ToolId; businessId: string | null }>({ toolId, businessId: null });
  const [forecastSelection, setForecastSelection] = React.useState<{ toolId: ToolId; scenarioId: string | null }>({ toolId, scenarioId: null });
  const [propertySelection, setPropertySelection] = React.useState<{ toolId: ToolId; propertyId: string | null }>({ toolId, propertyId: null });
  const [weddingSelection, setWeddingSelection] = React.useState<{ toolId: ToolId; weddingId: string | null }>({ toolId, weddingId: null });
  const [selectionToolId, setSelectionToolId] = React.useState(toolId);
  const addRequestId = React.useRef(0);
  if (selectionToolId !== toolId) {
    setSelectionToolId(toolId);
    if (toolId === "property") setPropertySelection({ toolId, propertyId: null });
    if (toolId === "wedding") setWeddingSelection({ toolId, weddingId: null });
  }

  const projects = React.useMemo(() => rows<Project>(data, "projects").filter((project) => !project.deleted), [data]);
  const selectedProjectId = resolveProjectSelection(projects, projectSelection.toolId === toolId ? projectSelection.projectId : null);
  const contentPlans = React.useMemo(() => rows<ContentPlan>(data, "plans").filter((plan) => !plan.deleted), [data]);
  const channelAccounts = React.useMemo(() => rows<ChannelAccount>(data, "channels").filter((channel) => !channel.deleted), [data]);
  const selectedContentScope = resolveContentScope(data, contentSelection.toolId === toolId ? contentSelection.scope : null);
  const businesses = React.useMemo(() => businessCollection.rows.filter((business) => !business.deleted), [businessCollection.rows]);
  const selectedBusinessId = resolveBusinessSelection(businesses, businessSelection.toolId === toolId ? businessSelection.businessId : null);
  const properties = React.useMemo(() => rows<Property>(data, "properties").filter((property) => !property.deleted), [data]);
  const selectedPropertyId = resolvePropertySelection(properties, propertySelection.toolId === toolId ? propertySelection.propertyId : null);
  const selectedProperty = properties.find((property) => property.id === selectedPropertyId);
  const weddings = React.useMemo(() => rows<Wedding>(data, "wedding").filter((wedding) => !wedding.deleted), [data]);
  const selectedWeddingId = resolveWeddingSelection(weddings, weddingSelection.toolId === toolId ? weddingSelection.weddingId : null);
  const selectedWedding = weddings.find((wedding) => wedding.id === selectedWeddingId);
  const forecastChoice = forecastSelection.toolId === toolId ? forecastSelection.scenarioId : null;
  const selectedScenarioId = resolveScenarioSelection(data, selectedBusinessId, forecastChoice);
  const businessTool = ["inventory", "sales", "invoicing", "cash-flow"].includes(toolId);
  const scopedData = React.useMemo(() => toolId === "projects" ? scopeProjectData(data, selectedProjectId) : toolId === "content" ? scopeContentData(data, selectedContentScope) : toolId === "property" ? scopePropertyData(data, selectedPropertyId) : toolId === "wedding" ? scopeWeddingData(data, selectedWeddingId) : businessTool ? scopeBusinessData(data, selectedBusinessId, toolId === "cash-flow" ? selectedScenarioId : null) : data, [toolId, data, selectedProjectId, selectedContentScope, selectedPropertyId, selectedWeddingId, businessTool, selectedBusinessId, selectedScenarioId]);
  const tabs = React.useMemo(() => {
    const built = buildTabs(toolId, scopedData, { contentPlanId: selectedContentScope?.kind === "plan" ? selectedContentScope.id : null, businesses, selectedBusinessId, selectedScenarioId, selectedWeddingId });
    if (toolId === "projects") return filterProjectTabs(built, selectedProjectId, data);
    if (toolId === "content") return filterContentTabs(built, data, selectedContentScope);
    if (toolId === "property") return filterPropertyTabs(built, selectedPropertyId);
    return toolId === "wedding" ? filterWeddingTabs(built, selectedWeddingId) : built;
  }, [toolId, data, scopedData, selectedProjectId, selectedContentScope, selectedPropertyId, selectedWeddingId, businesses, selectedBusinessId, selectedScenarioId]);
  // These overviews already contain the complete summary, so showing LedgerTool's
  // headline cards above them repeats the same figures with a second time period.
  const operationsTool = ["bookkeeping", "inventory", "sales", "invoicing", "cash-flow", "wedding", "property", "nutrition", "projects", "habits", "content"].includes(toolId);
  const activeScenarioBusinessId = rows<CashScenario>(data, "scenarios").find((scenario) => scenario.id === selectedScenarioId)?.businessId;
  const activeCurrency = selectedProperty?.currency ?? selectedWedding?.currency ?? businesses.find((business) => business.id === selectedBusinessId)?.currency
    ?? businesses.find((business) => business.id === activeScenarioBusinessId)?.currency
    ?? currency;
  const dashboardMetrics = React.useMemo(() => operationsTool ? computeMetrics(toolId, scopedData, activeCurrency, t, selectedScenarioId) : [], [operationsTool, toolId, scopedData, activeCurrency, selectedScenarioId, t]);
  const metrics = React.useMemo(
    () => (toolId === "budget" || toolId === "debt" || toolId === "savings" || toolId === "nutrition" || toolId === "net-worth" || operationsTool ? [] : computeMetrics(toolId, data, activeCurrency, t, selectedScenarioId)),
    [toolId, data, activeCurrency, operationsTool, selectedScenarioId, t],
  );
  const displayTabs = React.useMemo(() => applyDrill(tabs, drill, toolId), [tabs, drill, toolId]);
  const selectedScenarios = React.useMemo(() => rows<CashScenario>(data, "scenarios").filter((scenario) => !scenario.deleted && (!selectedBusinessId || scenario.businessId === selectedBusinessId)), [data, selectedBusinessId]);

  if (loading) {
    return (
      <div className="grid gap-3">
        <div className="shimmer h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="shimmer h-24 rounded-[20px]" />
          ))}
        </div>
        <div className="shimmer h-64 rounded-[20px]" />
      </div>
    );
  }

  if (toolId === "bookkeeping") {
    return <BookkeepingBusinesses data={data} fallbackCurrency={currency} />;
  }

  return (
    <LedgerTool
      toolId={toolId}
      tabs={displayTabs}
      metrics={metrics.map((m) => (
        <MetricCard key={m.label} label={m.label} value={m.value} hint={m.hint} icon={m.icon} tone={m.tone} />
      ))}
      overview={
      <Overview
        toolId={toolId}
        data={scopedData}
        currency={activeCurrency}
        drill={drill}
        onDrill={setDrill}
        onOpenTab={setRequestedTab}
        onAddRecord={(tabId) => { setRequestedTab(tabId); setRequestedAdd({ tabId, id: ++addRequestId.current }); }}
        dashboardMetrics={dashboardMetrics}
        businessPortfolio={businessTool && !selectedBusinessId}
        propertyPortfolio={toolId === "property" && !selectedPropertyId}
        weddingPortfolio={toolId === "wedding" && !selectedWeddingId}
        businesses={businesses}
        selectedBusinessId={selectedBusinessId}
        selectedScenarioId={selectedScenarioId}
        scopeControl={toolId === "projects" ? <ProjectScopeControl projects={projects} selectedProjectId={selectedProjectId} onChange={(projectId) => setProjectSelection({ toolId, projectId })} /> : toolId === "content" ? <ContentScopeControl plans={contentPlans} channels={channelAccounts} scope={selectedContentScope} onChange={(scope) => setContentSelection({ toolId, scope })} onAddPlan={() => { setRequestedTab("plans"); setRequestedAdd({ tabId: "plans", id: ++addRequestId.current }); }} /> : toolId === "property" ? <PropertyScopeControl properties={properties} selectedPropertyId={selectedPropertyId} onChange={(propertyId) => setPropertySelection({ toolId, propertyId })} onAddProperty={() => { setRequestedTab("properties"); setRequestedAdd({ tabId: "properties", id: ++addRequestId.current }); }} /> : toolId === "wedding" ? <WeddingScopeControl data={data} weddings={weddings} selectedWeddingId={selectedWeddingId} onChange={(weddingId) => setWeddingSelection({ toolId, weddingId })} onAddWedding={() => { setRequestedTab("wedding"); setRequestedAdd({ tabId: "wedding", id: ++addRequestId.current }); }} onAssignLegacy={async (weddingId) => { const pending = unassignedWeddingRecordIds(data); let count = 0; for (const [collection, ids] of Object.entries(pending)) for (const id of ids) { const updated = await updateRecord<BaseRecord & { weddingId: string }>("wedding", collection, id, { weddingId }); if (updated) count += 1; } return count; }} /> : businessTool ? <BusinessScopeControl selectedBusinessId={selectedBusinessId} onBusinessChange={(businessId) => { setBusinessSelection({ toolId, businessId }); setForecastSelection({ toolId, scenarioId: null }); }} selectedScenarioId={selectedScenarioId} onScenarioChange={(scenarioId) => { setForecastSelection({ toolId, scenarioId }); const scenarioBusinessId = rows<CashScenario>(data, "scenarios").find((scenario) => scenario.id === scenarioId)?.businessId; if (scenarioBusinessId) setBusinessSelection({ toolId, businessId: scenarioBusinessId }); }} scenarios={selectedScenarios} showScenario={toolId === "cash-flow"} /> : null}
      />
      }
      addRequest={requestedAdd}
      onAddRequestHandled={(id) => setRequestedAdd((current) => current?.id === id ? null : current)}
      defaultTab={requestedTab ?? (drill.month || drill.day || drill.categoryId ? "transactions" : undefined)}
      onClearFilter={() => setDrill({})}
    />
  );
}

/* ==========================================================================
   Overview panels
   ========================================================================== */

function Overview({
  toolId,
  data,
  currency,
  drill,
  onDrill,
  onOpenTab,
  onAddRecord,
  dashboardMetrics,
  scopeControl,
  businessPortfolio,
  propertyPortfolio,
  weddingPortfolio,
  businesses,
  selectedBusinessId,
  selectedScenarioId,
}: {
  toolId: ToolId;
  data: DataMap;
  currency: string;
  drill: DrillState;
  onDrill: (next: DrillState) => void;
  onOpenTab: (tab: string) => void;
  onAddRecord: (tab: string) => void;
  dashboardMetrics: ReturnType<typeof computeMetrics>;
  scopeControl?: React.ReactNode;
  businessPortfolio: boolean;
  propertyPortfolio: boolean;
  weddingPortfolio: boolean;
  businesses: Business[];
  selectedBusinessId: string | null;
  selectedScenarioId: string | null;
}) {
  const { t } = useI18n();
  const operationsTool = ["bookkeeping", "inventory", "sales", "invoicing", "cash-flow", "wedding", "property", "nutrition", "projects", "habits", "content"].includes(toolId);
  if (operationsTool) {
    if (propertyPortfolio) return <div className="flex flex-col gap-3">{scopeControl}<PropertyPortfolioOverview data={data} /></div>;
    if (weddingPortfolio) return <div className="flex flex-col gap-3">{scopeControl}<WeddingPortfolioOverview data={data} /></div>;
    if (businessPortfolio && ["inventory", "sales", "invoicing", "cash-flow"].includes(toolId)) {
      return <div className="flex flex-col gap-3">
        {scopeControl}
        <BusinessPortfolioOverview toolId={toolId} data={data} businesses={businesses} />
      </div>;
    }
    return <div className="flex flex-col gap-3">
      {scopeControl}
      {selectedBusinessId && (toolId === "sales" || toolId === "invoicing") ? <BusinessCurrencyNotice toolId={toolId} data={data} currency={currency} /> : null}
      <OperationsDashboard
        title={t(operationsDashboardTitle(toolId))}
        description={t("Live calculations from saved records · no unsupported history or integrations are assumed.")}
        kpis={dashboardMetrics}
        hero={<OperationsHero toolId={toolId} data={data} currency={currency} selectedScenarioId={selectedScenarioId} />}
        pin={{ chartId: operationsWidgetId(toolId), title: t(operationsWidgetTitle(toolId)), tool: toolId }}
      />
      <OverviewContent toolId={toolId} data={data} currency={currency} drill={drill} onDrill={onDrill} onOpenTab={onOpenTab} onAddRecord={onAddRecord} selectedScenarioId={selectedScenarioId} />
    </div>;
  }
  return <OverviewContent toolId={toolId} data={data} currency={currency} drill={drill} onDrill={onDrill} onOpenTab={onOpenTab} onAddRecord={onAddRecord} selectedScenarioId={selectedScenarioId} />;
}

function BusinessCurrencyNotice({ toolId, data, currency }: { toolId: ToolId; data: DataMap; currency: string }) {
  const { t } = useI18n();
  const collection = toolId === "sales" ? "sales" : "invoices";
  const count = (data[collection] ?? []).filter((record) => {
    const recordCurrency = (record as BaseRecord & { currency?: string }).currency;
    return recordCurrency && recordCurrency !== currency;
  }).length;
  if (!count) return null;
  return <p className="rounded-xl border border-line bg-[var(--surface)]/60 px-3 py-2 text-xs text-fg-muted">{t("{count} records in another currency are shown in tables and excluded from these totals.", { count })}</p>;
}

function BusinessPortfolioOverview({ toolId, data, businesses }: { toolId: ToolId; data: DataMap; businesses: Business[] }) {
  const { t } = useI18n();
  const cardData = businesses.map((business) => ({ business, data: scopeBusinessData(data, business.id) }));
  const scopedCollections = toolId === "inventory" ? ["products", "movements"] : toolId === "sales" ? ["sales", "targets"] : toolId === "invoicing" ? ["invoices", "payments", "contacts"] : ["items", "scenarios"];
  const unassignedCount = scopedCollections.reduce((count, collection) => count + (data[collection] ?? []).filter((row) => !(row as BaseRecord & { businessId?: string }).businessId).length, 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cardData.map(({ business, data: businessData }) => {
        const prefix = <div className="mb-3 flex items-center justify-between gap-2"><h2 className="truncate text-sm font-semibold">{business.name}</h2><span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-fg-muted">{business.currency}</span></div>;
        if (toolId === "inventory") {
          const summary = inventorySummary(rows<BusinessProduct>(businessData, "products"), rows<InventoryMovement>(businessData, "movements"));
          return <Card key={business.id} className="p-4">{prefix}<div className="grid grid-cols-2 gap-2"><CompactMetric label={t("Active SKUs")} value={String(summary.productCount)} /><CompactMetric label={t("Units in stock")} value={String(summary.totalUnits)} /><CompactMetric label={t("Inventory at cost")} value={formatMoney(summary.inventoryValue, { currency: business.currency })} /><CompactMetric label={t("Low stock")} value={String(summary.lowStock.length)} /></div></Card>;
        }
        if (toolId === "sales") {
          const sales = rows<Sale>(businessData, "sales");
          const targets = rows<SalesTarget>(businessData, "targets");
          const currencies = [...new Set([business.currency, ...sales.map((sale) => sale.currency || business.currency), ...targets.map((target) => target.currency || business.currency)])];
          return <Card key={business.id} className="p-4">{prefix}<div className="grid gap-3">{currencies.map((currency) => {
            const summary = salesSummary(sales.filter((sale) => (sale.currency || business.currency) === currency), targets.filter((target) => (target.currency || business.currency) === currency), { period: currentMonth() });
            return <div key={currency} className="rounded-xl border border-line p-3"><p className="mb-2 text-[11px] text-fg-muted">{currency}</p><div className="grid grid-cols-2 gap-2"><CompactMetric label={t("Sales revenue")} value={formatMoney(summary.net, { currency })} /><CompactMetric label={t("Number of sales")} value={String(summary.orders)} /><CompactMetric label={t("Average order")} value={summary.averageOrderValue == null ? "—" : formatMoney(summary.averageOrderValue, { currency })} /><CompactMetric label={t("Target progress")} value={summary.target ? formatPercent(summary.targetProgress ?? 0) : "—"} /></div></div>;
          })}</div></Card>;
        }
        if (toolId === "invoicing") {
          const allInvoices = rows<Invoice>(businessData, "invoices");
          const currencies = [...new Set([business.currency, ...allInvoices.map((invoice) => invoice.currency || business.currency)])];
          return <Card key={business.id} className="p-4">{prefix}<div className="grid gap-3">{currencies.map((currency) => {
            const invoices = allInvoices.filter((invoice) => (invoice.currency || business.currency) === currency);
            const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
            const payments = rows<Payment>(businessData, "payments").filter((payment) => invoiceIds.has(payment.invoiceId));
            const summary = invoicingSummary(invoices, payments, todayISO());
            const invoiced = summary.rows.filter((row) => row.invoice.status !== "draft" && row.invoice.status !== "void").reduce((total, row) => total + row.totals.total, 0);
            const paid = summary.rows.reduce((total, row) => total + row.totals.paid, 0);
            return <div key={currency} className="rounded-xl border border-line p-3"><p className="mb-2 text-[11px] text-fg-muted">{currency}</p><div className="grid grid-cols-2 gap-2"><CompactMetric label={t("Total invoiced")} value={formatMoney(invoiced, { currency })} /><CompactMetric label={t("Payments collected")} value={formatMoney(paid, { currency })} /><CompactMetric label={t("Outstanding balance")} value={formatMoney(summary.outstanding, { currency })} /><CompactMetric label={t("Overdue balance")} value={formatMoney(summary.overdueAmount, { currency })} /></div></div>;
          })}</div></Card>;
        }
        const scenarios = rows<CashScenario>(businessData, "scenarios").filter((scenario) => !scenario.deleted);
        return <Card key={business.id} className="p-4">{prefix}{scenarios.length ? <div className="grid gap-2">{scenarios.map((scenario) => {
          const scenarioItems = rows<CashForecastItem>(businessData, "items").filter((item) => item.scenarioId === scenario.id);
          const forecast = forecastCashFlow(scenarioItems, scenario, { weeks: 13 });
          return <div key={scenario.id} className="rounded-xl border border-line p-3"><p className="mb-2 text-xs font-medium">{scenario.name}</p><div className="grid grid-cols-2 gap-2"><CompactMetric label={t("Opening cash")} value={formatMoney(scenario.openingCash, { currency: business.currency })} /><CompactMetric label={t("Projected closing")} value={formatMoney(forecast.closingCash, { currency: business.currency })} /></div></div>;
        })}</div> : <p className="text-xs text-fg-muted">{t("No forecasts for this business yet.")}</p>}</Card>;
      })}
      {unassignedCount ? <Card className="p-4"><h2 className="text-sm font-semibold">{t("Unassigned legacy records")}</h2><p className="mt-1 text-xs text-fg-muted">{t("These records are preserved and are not included in any business total.")}</p><p className="mt-3 text-sm">{t("Records")}: {unassignedCount}</p></Card> : null}
      {!businesses.length ? <Card className="p-4"><p className="text-sm font-medium">{t("Create a business to start organizing your books.")}</p><p className="mt-1 text-xs text-fg-muted">{t("Use Add Business to create your first business context.")}</p></Card> : null}
    </div>
  );
}

function ProjectScopeControl({ projects, selectedProjectId, onChange }: { projects: Project[]; selectedProjectId: string | null; onChange: (projectId: string | null) => void }) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-[var(--surface)]/70 px-3 py-2">
      <div>
        <p className="text-[12px] font-medium">{t("Project scope")}</p>
        <p className="text-[10.5px] text-fg-subtle">{t("Apply one project selection to the dashboard and records")}</p>
      </div>
      <Select aria-label={t("Filter by project")} value={selectedProjectId ?? ""} onChange={(event) => onChange(event.target.value || null)} className="h-9 w-auto min-w-36 max-w-full">
        <option value="">{t("All Projects")}</option>
        {projects.map((project) => <option key={project.id} value={project.id} data-raw="">{project.name}</option>)}
      </Select>
    </div>
  );
}

function PropertyScopeControl({ properties, selectedPropertyId, onChange, onAddProperty }: { properties: Property[]; selectedPropertyId: string | null; onChange: (propertyId: string | null) => void; onAddProperty: () => void }) {
  const { t } = useI18n();
  const [manageOpen, setManageOpen] = React.useState(false);
  const [archived, setArchived] = React.useState<Property[]>([]);
  React.useEffect(() => {
    let alive = true;
    const reload = () => { void listArchivedRecords<Property>("property", "properties").then((rows) => { if (alive) setArchived(rows); }); };
    reload();
    const unsubscribeRecords = subscribe("property", "properties", reload);
    const unsubscribeWorkspace = subscribeWorkspaceScope(reload);
    return () => { alive = false; unsubscribeRecords(); unsubscribeWorkspace(); };
  }, []);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-[var(--surface)]/70 px-3 py-2">
      <div>
        <p className="text-[12px] font-medium">{t("Property scope")}</p>
        <p className="text-[10.5px] text-fg-subtle">{t("Apply one property selection to the dashboard and records")}</p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
        <AnimatedTabs
          ariaLabel={t("Filter by property")}
          value={selectedPropertyId ?? "all"}
          onChange={(value) => onChange(value === "all" ? null : value)}
          options={[{ value: "all", label: t("All Properties") }, ...properties.map((property) => ({ value: property.id, label: property.name }))]}
          className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-[var(--bg-subtle)]/60 p-1 thin-scroll"
          buttonClassName="h-8 px-3 text-xs"
        />
        <Button variant="secondary" size="sm" icon="plus" onClick={onAddProperty}>{t("Add Property")}</Button>
        {archived.length ? <Button variant="ghost" size="sm" onClick={() => setManageOpen(true)}>{t("Archived properties")} ({archived.length})</Button> : null}
      </div>
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent title="Archived properties" description="Restore a property to include it in the portfolio again." className="max-w-xl">
          <div className="grid gap-2">
            {archived.map((property) => <div key={property.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{property.name}</p><p className="text-xs text-fg-muted">{property.currency || "USD"} · {property.context === "business" ? t("Business") : t("Personal")}</p></div>
              <Button variant="secondary" size="sm" onClick={() => void restoreRecord("property", "properties", property.id)}>{t("Restore")}</Button>
            </div>)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WeddingScopeControl({ data, weddings, selectedWeddingId, onChange, onAddWedding, onAssignLegacy }: { data: DataMap; weddings: Wedding[]; selectedWeddingId: string | null; onChange: (weddingId: string | null) => void; onAddWedding: () => void; onAssignLegacy: (weddingId: string) => Promise<number> }) {
  const { t } = useI18n();
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [targetWeddingId, setTargetWeddingId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const legacyCount = Object.values(unassignedWeddingRecordIds(data)).reduce((total, ids) => total + ids.length, 0);
  const assign = async () => {
    if (!targetWeddingId || saving) return;
    setSaving(true);
    try {
      const count = await onAssignLegacy(targetWeddingId);
      toast.success(t("{count} legacy wedding records assigned.", { count }));
      setAssignOpen(false);
      setTargetWeddingId("");
    } catch {
      toast.error(t("Legacy wedding records could not be assigned."));
    } finally { setSaving(false); }
  };
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-[var(--surface)]/70 px-3 py-2">
    <div><p className="text-[12px] font-medium">{t("Wedding scope")}</p><p className="text-[10.5px] text-fg-subtle">{t("Choose one event or review the full wedding portfolio")}</p></div>
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <AnimatedTabs
        ariaLabel={t("Filter by wedding")}
        value={selectedWeddingId ?? "all-weddings"}
        onChange={(value) => onChange(value === "all-weddings" ? null : value)}
        options={[{ value: "all-weddings", label: t("All Weddings") }, ...weddings.map((wedding) => ({ value: wedding.id, label: wedding.couple }))]}
        className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-[var(--bg-subtle)]/60 p-1 thin-scroll"
        buttonClassName="h-8 px-3 text-xs"
      />
      <Button variant="secondary" size="sm" icon="plus" onClick={onAddWedding}>{t("New wedding")}</Button>
      {legacyCount ? <Button variant="ghost" size="sm" onClick={() => setAssignOpen(true)}>{t("Review unassigned records")} ({legacyCount})</Button> : null}
    </div>
    <Dialog open={assignOpen} onOpenChange={(open) => { if (!saving) setAssignOpen(open); }}>
      <DialogContent title={t("Assign legacy wedding records?")} description={t("{count} existing records have no active wedding assigned. Choose one event only if these records all belong to it; their IDs and details will be preserved.", { count: legacyCount })}>
        <div className="grid gap-4">
          <Select aria-label={t("Choose wedding for legacy records")} value={targetWeddingId} onChange={(event) => setTargetWeddingId(event.target.value)}>
            <option value="">{t("Choose a wedding")}</option>
            {weddings.map((wedding) => <option key={wedding.id} value={wedding.id} data-raw="">{wedding.couple}</option>)}
          </Select>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setAssignOpen(false)} disabled={saving}>{t("Cancel")}</Button><Button variant="primary" onClick={() => void assign()} disabled={!targetWeddingId || saving}>{saving ? t("Saving…") : t("Assign records")}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

function WeddingPortfolioOverview({ data }: { data: DataMap }) {
  const { t } = useI18n();
  const weddings = rows<Wedding>(data, "wedding").filter((wedding) => !wedding.deleted);
  const today = todayISO();
  const children = {
    expenses: rows<WeddingExpense>(data, "expenses"),
    guests: rows<WeddingGuest>(data, "guests"),
    vendors: rows<WeddingVendor>(data, "vendors"),
    payments: rows<WeddingPayment>(data, "payments"),
    tables: rows<WeddingTable>(data, "tables"),
  };
  const summaries = weddings.map((wedding) => ({
    wedding,
    summary: weddingSummary({
      eventDate: wedding.eventDate,
      totalBudget: wedding.totalBudget,
      expenses: children.expenses.filter((row) => row.weddingId === wedding.id),
      guests: children.guests.filter((row) => row.weddingId === wedding.id),
      vendors: children.vendors.filter((row) => row.weddingId === wedding.id),
      payments: children.payments.filter((row) => row.weddingId === wedding.id),
      tables: children.tables.filter((row) => row.weddingId === wedding.id),
      today,
    }),
  }));
  const currencies = [...new Set(weddings.map((wedding) => wedding.currency || "USD"))];
  const legacyCount = Object.values(unassignedWeddingRecordIds(data)).reduce((total, ids) => total + ids.length, 0);
  return <div className="grid gap-3">
    {summaries.length ? currencies.map((currencyCode) => {
      const lane = summaries.filter(({ wedding }) => (wedding.currency || "USD") === currencyCode);
      const budget = metricSum(lane.map(({ wedding }) => wedding.totalBudget));
      const committed = metricSum(lane.map(({ summary }) => summary.committed));
      const actual = metricSum(lane.map(({ summary }) => summary.actualExpenses));
      const paid = metricSum(lane.map(({ summary }) => summary.paid));
      return <Card key={currencyCode} className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">{t("Wedding portfolio")}</h2><span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-fg-muted">{currencyCode}</span></div>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><CompactMetric label={t("Events")} value={String(lane.length)} /><CompactMetric label={t("Combined budgets")} value={formatMoney(budget, { currency: currencyCode })} /><CompactMetric label={t("Committed costs") } value={formatMoney(committed, { currency: currencyCode })} /><CompactMetric label={t("Actual spend / paid") } value={`${formatMoney(actual, { currency: currencyCode })} / ${formatMoney(paid, { currency: currencyCode })}`} /></div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{lane.map(({ wedding, summary }) => <div key={wedding.id} className="rounded-xl border border-line bg-[var(--bg-subtle)]/30 p-3">
          <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{wedding.couple}</p><p className="text-xs text-fg-muted">{formatDate(wedding.eventDate)}{wedding.venue ? ` · ${wedding.venue}` : ""}</p></div><span className="shrink-0 text-xs">{summary.daysUntil < 0 ? t("Past event") : t("{count} days", { count: summary.daysUntil })}</span></div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs"><span className="text-fg-muted">{t("Guests accepted")}</span><span className="text-right">{summary.guestSeatsAccepted}/{summary.guestSeatsInvited}</span><span className="text-fg-muted">{t("Budget remaining")}</span><span className="text-right tnum">{formatMoney(summary.budgetRemaining, { currency: currencyCode })}</span><span className="text-fg-muted">{t("Unseated guests")}</span><span className="text-right">{summary.unseated}</span></div>
        </div>)}</div>
      </Card>;
    }) : <Card className="p-4"><EmptyState title={t("No weddings yet")} description={t("Create a wedding to organize guests, vendors, costs, and tasks.")} icon="heart" /></Card>}
    {legacyCount ? <Card className="border-[color-mix(in_oklab,var(--warning)_35%,transparent)] p-4"><h2 className="text-sm font-semibold">{t("Unassigned legacy records")}</h2><p className="mt-1 text-xs text-fg-muted">{t("These existing planning records have no active event link. They remain preserved until you explicitly assign them from the wedding selector.")}</p><p className="mt-2 text-sm">{t("Records")}: {legacyCount}</p></Card> : null}
  </div>;
}

function PropertyPortfolioOverview({ data }: { data: DataMap }) {
  const { t } = useI18n();
  const properties = rows<Property>(data, "properties").filter((property) => !property.deleted);
  const units = rows<PropertyUnit>(data, "units").filter((unit) => !unit.deleted);
  const activePropertyIds = new Set(properties.map((property) => property.id));
  const bookings = rows<PropertyBooking>(data, "bookings").filter((booking) => !booking.deleted && booking.status !== "cancelled" && activePropertyIds.has(booking.propertyId));
  const expenses = rows<PropertyExpense>(data, "expenses").filter((expense) => !expense.deleted);
  const maintenance = rows<PropertyMaintenance>(data, "maintenance").filter((item) => !item.deleted);
  const today = todayISO();
  const year = today.slice(0, 4);
  const yearStart = `${year}-01-01`;
  const elapsedDays = Math.max(1, Math.floor((new Date(`${today}T00:00:00`).getTime() - new Date(`${yearStart}T00:00:00`).getTime()) / 86400000) + 1);
  const activeUnitIds = new Set(units.filter((unit) => activePropertyIds.has(unit.propertyId)).map((unit) => unit.id));
  const occupiedUnitIds = new Set(bookings.filter((booking) => booking.checkIn <= today && booking.checkOut > today && activeUnitIds.has(booking.unitId)).map((booking) => booking.unitId));
  const propertySummaries = properties.map((property) => {
    const propertyUnits = units.filter((unit) => unit.propertyId === property.id);
    const propertyBookings = bookings.filter((booking) => booking.propertyId === property.id);
    const summary = propertySummary({
      bookings: propertyBookings,
      expenses: expenses.filter((expense) => expense.propertyId === property.id),
      maintenance: maintenance.filter((item) => item.propertyId === property.id),
      availableNights: elapsedDays * propertyUnits.length,
      period: year,
    });
    return { property, units: propertyUnits, summary, occupied: propertyUnits.filter((unit) => occupiedUnitIds.has(unit.id)).length };
  });
  const currencies = [...new Set(properties.map((property) => property.currency || "USD"))];
  const upcomingBookings = bookings.filter((booking) => booking.checkIn >= today).length;
  const attentionMaintenance = maintenance.filter((item) => !item.done).length;
  const totalUnits = units.filter((unit) => activePropertyIds.has(unit.propertyId)).length;

  return <div className="grid gap-3">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <CompactMetric label={t("Properties")} value={String(properties.length)} />
      <CompactMetric label={t("Total units")} value={String(totalUnits)} />
      <CompactMetric label={t("Occupied units")} value={String(occupiedUnitIds.size)} />
      <CompactMetric label={t("Vacant units")} value={String(Math.max(0, totalUnits - occupiedUnitIds.size))} />
      <CompactMetric label={t("Upcoming bookings")} value={String(upcomingBookings)} />
      <CompactMetric label={t("Maintenance requiring attention")} value={String(attentionMaintenance)} />
    </div>
    {properties.length ? currencies.map((currencyCode) => {
      const lane = propertySummaries.filter(({ property }) => (property.currency || "USD") === currencyCode);
      const revenue = metricSum(lane.map(({ summary }) => summary.accommodationRevenue));
      const expensesTotal = metricSum(lane.map(({ summary }) => summary.operatingExpenses));
      const net = metricSum(lane.map(({ summary }) => summary.netOperatingIncome));
      return <Card key={currencyCode} className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">{t("Portfolio totals")}</h2><span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-fg-muted">{currencyCode} · {year}</span></div>
        <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <CompactMetric label={t("Rental revenue")} value={formatMoney(revenue, { currency: currencyCode })} />
          <CompactMetric label={t("Operating expenses")} value={formatMoney(expensesTotal, { currency: currencyCode })} />
          <CompactMetric label={t("Net operating income")} value={formatMoney(net, { currency: currencyCode })} tone={net >= 0 ? "positive" : "negative"} />
        </div>
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div><p className="mb-2 text-xs font-medium">{t("Revenue by property")}</p><div className="grid gap-2">{lane.map(({ property, summary }) => {
            const maxRevenue = Math.max(1, ...lane.map((item) => item.summary.accommodationRevenue));
            return <div key={property.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1"><span className="truncate text-xs text-fg-muted">{property.name}</span><span className="text-xs tnum">{formatMoney(summary.accommodationRevenue, { currency: currencyCode })}</span><div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]"><div className="h-full rounded-full bg-[var(--positive)]" style={{ width: `${Math.max(0, summary.accommodationRevenue / maxRevenue * 100)}%` }} /></div></div>;
          })}</div></div>
          <div><p className="mb-2 text-xs font-medium">{t("Occupancy by property")}</p><div className="grid gap-2">{lane.map(({ property, summary }) => <div key={property.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1"><span className="truncate text-xs text-fg-muted">{property.name}</span><span className="text-xs tnum">{summary.occupancyRate == null ? "—" : formatPercent(summary.occupancyRate)}</span><div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(0, Math.min(100, summary.occupancyRate ?? 0))}%` }} /></div></div>)}</div></div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {lane.map(({ property, units: propertyUnits, summary, occupied }) => <div key={property.id} className="rounded-xl border border-line bg-[var(--bg-subtle)]/30 p-3">
            <div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium">{property.name}</p><span className="shrink-0 text-xs text-fg-muted">{property.currency || "USD"}</span></div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs"><span className="text-fg-muted">{t("Rental revenue")}</span><span className="text-right tnum">{formatMoney(summary.accommodationRevenue, { currency: currencyCode })}</span><span className="text-fg-muted">{t("Occupancy")}</span><span className="text-right">{formatPercent(summary.occupancyRate)}</span><span className="text-fg-muted">{t("Occupied units")}</span><span className="text-right">{occupied}/{propertyUnits.length}</span></div>
          </div>)}
        </div>
      </Card>;
    }) : <Card className="p-4"><EmptyState title={t("No properties")} description={t("Add a property to see your portfolio overview.")} icon="home" /></Card>}
  </div>;
}

function ContentScopeControl({ plans, channels, scope, onChange, onAddPlan }: { plans: ContentPlan[]; channels: ChannelAccount[]; scope: ContentScope; onChange: (scope: ContentScope) => void; onAddPlan: () => void }) {
  const { t } = useI18n();
  const value = scope ? `${scope.kind}:${scope.id}` : "";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-[var(--surface)]/70 px-3 py-2">
      <div>
        <p className="text-[12px] font-medium">{t("Content scope")}</p>
        <p className="text-[10.5px] text-fg-subtle">{t("Filter content, publications, charts and KPIs by plan or account")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label={t("Filter content by plan or channel")} value={value} onChange={(event) => {
          const [kind, ...parts] = event.target.value.split(":");
          const id = parts.join(":");
          onChange((kind === "plan" || kind === "channel") && id ? { kind, id } : null);
        }} className="h-9 w-auto min-w-40 max-w-full">
          <option value="">{t("All Content")}</option>
          {plans.map((plan) => <option key={`plan:${plan.id}`} value={`plan:${plan.id}`} data-raw="">{t("Content plans")}: {plan.name}</option>)}
          {channels.map((channel) => <option key={`channel:${channel.id}`} value={`channel:${channel.id}`} data-raw="">{t("Channel")}: {channel.name}</option>)}
        </Select>
        <Button variant="secondary" size="sm" icon="plus" onClick={onAddPlan}>{t("New plan")}</Button>
      </div>
    </div>
  );
}

function operationsDashboardTitle(toolId: ToolId) {
  return ({ bookkeeping: "Bookkeeping dashboard", inventory: "Inventory dashboard", sales: "Sales dashboard", invoicing: "Invoice and collections dashboard", "cash-flow": "Cash flow forecast", wedding: "Wedding command center", property: "Rental portfolio dashboard", nutrition: "Nutrition dashboard", projects: "Project dashboard", habits: "Habit dashboard", content: "Content planning dashboard" } as Partial<Record<ToolId, string>>)[toolId] ?? "Dashboard";
}
function operationsWidgetId(toolId: ToolId) {
  return ({ bookkeeping: "bookkeeping.expenses", inventory: "inventory.value", sales: "sales.products", invoicing: "invoicing.outstanding", "cash-flow": "cash-flow.forecast", wedding: "wedding.budget", property: "property.expenses", nutrition: "nutrition.macros", projects: "projects.status", habits: "habits.today", content: "content.pipeline" } as Partial<Record<ToolId, string>>)[toolId] ?? "";
}
function operationsWidgetTitle(toolId: ToolId) {
  return ({ bookkeeping: "Expenses by category", inventory: "Inventory value by category", sales: "Sales by product", invoicing: "Receivables status", "cash-flow": "Projected cash balance", wedding: "Wedding budget allocation", property: "Rental expenses by category", nutrition: "Daily macro balance", projects: "Task status", habits: "Today's habit check-ins", content: "Content pipeline" } as Partial<Record<ToolId, string>>)[toolId] ?? "Overview";
}

function OverviewContent({
  toolId,
  data,
  currency,
  drill,
  onDrill,
  onOpenTab,
  onAddRecord,
  selectedScenarioId,
}: {
  toolId: ToolId;
  data: DataMap;
  currency: string;
  drill: DrillState;
  onDrill: (next: DrillState) => void;
  onOpenTab: (tab: string) => void;
  onAddRecord: (tab: string) => void;
  selectedScenarioId: string | null;
}) {
  switch (toolId) {
    case "paycheck":
      return <PaycheckDashboard data={data} currency={currency} onOpenAllocations={() => onOpenTab("allocations")} />;
    case "budget":
      return <BudgetOverview data={data} currency={currency} drill={drill} onDrill={onDrill} />;
    case "debt":
      return <DebtDashboard currency={currency} />;
    case "savings":
      return <SavingsDashboard data={data} currency={currency} onOpenTab={onOpenTab} />;
    case "projects":
      return <ProjectsBoard data={data} />;
    case "habits":
      return <HabitGrid data={data} />;
    case "nutrition":
      return <NutritionDiary data={data} />;
    case "invoicing":
      return <InvoicingOverview data={data} currency={currency} />;
    case "net-worth":
      return <NetWorthDashboard data={data} currency={currency} onOpenTab={onOpenTab} onAddRecord={onAddRecord} />;
    case "bookkeeping":
    case "inventory":
    case "sales":
    case "cash-flow":
    case "wedding":
    case "property":
    case "content":
      return <ToolCharts toolId={toolId} data={data} currency={currency} selectedScenarioId={selectedScenarioId} />;
    default:
      return null;
  }
}

function ToolCharts({ toolId, data, currency, selectedScenarioId }: { toolId: ToolId; data: DataMap; currency: string; selectedScenarioId: string | null }) {
  const { t } = useI18n();
  const money = (value: number | string | undefined) => formatMoney(Number(value ?? 0), { currency, maximumFractionDigits: 0 });
  if (toolId === "bookkeeping") {
    const transactions = rows<BusinessTransaction>(data, "transactions");
    if (!transactions.length) return null;
    const grouped = new Map<string, { income: number; expenses: number }>();
    for (const transaction of transactions) {
      if (!transaction.date) continue;
      const period = transaction.date.slice(0, 7);
      const current = grouped.get(period) ?? { income: 0, expenses: 0 };
      if (transaction.type === "revenue") current.income += transaction.amount;
      if (transaction.type === "expense") current.expenses += transaction.amount;
      grouped.set(period, current);
    }
    const trend = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, values]) => ({ label: monthLong(period), ...values }));
    return <ChartContainer title={t("Business income and expenses")} subtitle={t("Recorded revenue and operating expenses by month")} icon="chart-column"><TrendChart data={trend} xKey="label" series={[{ key: "income", name: t("Revenue") }, { key: "expenses", name: t("Expenses") }]} formatValue={money} type="line" height={240} /></ChartContainer>;
  }
  if (toolId === "inventory") {
    const products = rows<BusinessProduct>(data, "products");
    if (!products.length) return null;
    return <ChartContainer title={t("Stock on hand")} subtitle={t("Units by product · weighted average inventory tracking")} icon="package"><HorizontalRankingChart data={products.map((product) => ({ id: product.id, label: product.name, value: product.quantity }))} formatValue={(value) => t("{count} units", { count: Number(value ?? 0) })} maxItems={10} height={Math.max(170, Math.min(products.length, 10) * 32 + 30)} /></ChartContainer>;
  }
  if (toolId === "sales") {
    const summary = salesSummary(rows<Sale>(data, "sales").filter((row) => (row.currency || "USD") === currency), rows<SalesTarget>(data, "targets").filter((row) => (row.currency || "USD") === currency));
    if (!summary.byMonth.length) return null;
    return <ChartContainer title={t("Sales revenue trend")} subtitle={t("Net sales by month, after discounts and returns")} icon="trending-up"><TrendChart data={summary.byMonth.map((item) => ({ label: monthLong(item.month), net: item.net }))} xKey="label" series={[{ key: "net", name: t("Net sales") }]} formatValue={money} type="line" height={240} /></ChartContainer>;
  }
  if (toolId === "cash-flow") {
    const scenario = selectedScenarioId ? rows<CashScenario>(data, "scenarios").find((row) => row.id === selectedScenarioId) : undefined;
    if (!scenario) return null;
    const scenarioItems = rows<CashForecastItem>(data, "items").filter((row) => row.scenarioId === scenario.id);
    const forecast = forecastCashFlow(scenarioItems, scenario, { weeks: 13 });
    return <ChartContainer title={t("13-week cash forecast")} subtitle={t("Projected closing balance with weekly inflows and outflows")} icon="waves"><TrendChart data={forecast.weeks.map((week) => ({ label: new Date(`${week.label}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }), closing: week.closing, minimum: scenario.minimumCash }))} xKey="label" series={[{ key: "closing", name: t("Closing cash") }, { key: "minimum", name: t("Minimum cash") }]} formatValue={money} type="area" height={240} /></ChartContainer>;
  }
  if (toolId === "wedding") {
    const expenses = rows<WeddingExpense>(data, "expenses");
    if (!expenses.length) return null;
    return <ChartContainer title={t("Wedding spend by category")} subtitle={t("Committed budget compared with actual spend")} icon="heart"><TrendChart data={expenses.map((expense) => ({ label: expense.category, committed: expense.committed, actual: expense.actual }))} xKey="label" series={[{ key: "committed", name: t("Committed") }, { key: "actual", name: t("Actual") }]} formatValue={money} type="line" height={Math.max(200, Math.min(expenses.length, 8) * 35 + 50)} /></ChartContainer>;
  }
  if (toolId === "property") {
    const propertyIds = new Set(rows<Property>(data, "properties").filter((row) => !row.deleted && (row.currency || "USD") === currency).map((row) => row.id));
    const bookings = rows<PropertyBooking>(data, "bookings").filter((booking) => booking.status !== "cancelled" && propertyIds.has(booking.propertyId));
    if (!bookings.length) return null;
    const monthly = new Map<string, { revenue: number; nights: number }>();
    for (const booking of bookings) {
      if (!booking.checkIn) continue;
      const period = booking.checkIn.slice(0, 7);
      const totals = monthly.get(period) ?? { revenue: 0, nights: 0 };
      totals.revenue += booking.accommodation;
      totals.nights += booking.nights;
      monthly.set(period, totals);
    }
    return <ChartContainer title={t("Property booking revenue")} subtitle={t("Accommodation revenue by check-in month")} icon="home"><TrendChart data={[...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, values]) => ({ label: monthLong(period), revenue: values.revenue }))} xKey="label" series={[{ key: "revenue", name: t("Revenue") }]} formatValue={money} type="line" height={240} /></ChartContainer>;
  }
  if (toolId === "content") {
    const posts = rows<ContentPost>(data, "posts");
    const publications = rows<ContentPublication>(data, "publications");
    if (!posts.length && !publications.length) return null;
    const publicationPostIds = new Set(publications.map((publication) => publication.contentId));
    const legacyPosts = posts.filter((post) => !publicationPostIds.has(post.id));
    const hasDestinations = publications.length > 0;
    const source = hasDestinations ? [...publications, ...legacyPosts] : posts;
    const statusOrder = ["idea", "draft", "scheduled", "published"] as const;
    const counts = statusOrder.map((status) => ({ id: status, label: t(status[0].toUpperCase() + status.slice(1)), value: source.filter((item) => item.status === status).length }));
    return <ChartContainer title={t(hasDestinations ? "Publishing destinations" : "Publishing pipeline")} subtitle={t(hasDestinations ? "Status and counts for channel-specific publications" : "Content count by current status")} icon="calendar-range"><HorizontalRankingChart data={counts} formatValue={(value) => t(hasDestinations ? "{count} destinations" : "{count} posts", { count: Number(value ?? 0) })} height={175} /></ChartContainer>;
  }
  return null;
}

function BudgetOverview({
  data,
  currency,
  drill,
  onDrill,
}: {
  data: DataMap;
  currency: string;
  drill: DrillState;
  onDrill: (next: DrillState) => void;
}) {
  const { t } = useI18n();
  const transactions = rows<MoneyTransaction>(data, "transactions");
  const categories = rows<MoneyCategory>(data, "categories");
  const budgets = rows<MoneyBudget>(data, "budgets");

  const yearOpts = React.useMemo(
    () => yearOptions(transactions.map((tx) => tx.date), 6),
    [transactions],
  );
  const { value: year, setValue: setYear } = useToolPeriod(
    "budget",
    yearOpts,
    currentYear(),
  );

  const summary = React.useMemo(
    () =>
      budgetSummary({
        transactions,
        categories,
        budgets,
        period: year,
        currency,
      }),
    [transactions, categories, budgets, year, currency],
  );

  const annualBudget = React.useMemo(
    () => annualBudgetAllocation(budgets, year),
    [budgets, year],
  );
  const budgetRemaining = Math.round((annualBudget - summary.expenses) * 100) / 100;
  const baRows = React.useMemo(
    () => annualBudgetVsActual({ transactions, categories, budgets, year, currency }),
    [transactions, categories, budgets, year, currency],
  );
  const slices = React.useMemo(() => categorySlices(summary.byCategory), [summary]);
  const trend = React.useMemo(() => cashFlowTrend(summary), [summary]);
  const chartFmt = (v: number | string | undefined) =>
    formatMoney(Number(v ?? 0), { currency, maximumFractionDigits: 0 });
  const categoryDonut = (
    <ChartContainer
      title={t("Spending by category")}
      subtitle={t("Donut · tap a slice to filter")}
      icon="tag"
      action={<PinChartButton chartId="budget.categories" title={t("Spending by category")} tool="budget" />}
    >
      <CategoryBreakdownChart
        data={slices}
        formatValue={chartFmt}
        centerLabel={t("Spent")}
        centerValue={chartFmt(summary.expenses)}
        height={242}
        onSliceClick={(id) => {
          if (id === "__other__") return;
          const name = slices.find((slice) => slice.id === id)?.name ?? "—";
          onDrill({ categoryId: id, categoryName: name });
        }}
      />
    </ChartContainer>
  );

  if (!summary.transactionCount) {
    return (
      <ChartEmptyState label={t("Add income and expenses to see your annual budget take shape")} />
    );
  }

  // --- Month drill-down: a focused, returnable view of one month (spec #4) ---
  if (drill.month) {
    const monthSummary = budgetSummary({
      transactions,
      categories,
      budgets,
      period: drill.month,
      currency,
    });
    const monthSlices = categorySlices(monthSummary.byCategory, { maxSlices: 6 });
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" icon="arrowLeft" iconTrigger="click" onClick={() => onDrill({})}>
              {t("Back to {year}", { year })}
            </Button>
            <h2 className="text-[15px] font-semibold">{monthLong(drill.month)}</h2>
          </div>
          <PinChartButton chartId="budget.monthly" title={t("Monthly income vs expenses")} tool="budget" />
        </div>

        <div className="grid auto-rows-fr grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <MetricCard label={t("Income")} value={formatMoney(monthSummary.income, { currency })} icon="arrowUp" />
          <MetricCard label={t("Expenses")} value={formatMoney(monthSummary.expenses, { currency })} icon="arrowDown" tone="negative" />
          <MetricCard
            label={t("Net cash flow")}
            value={formatMoney(monthSummary.netCashFlow, { currency, signed: true })}
            icon="wallet"
            tone={monthSummary.netCashFlow >= 0 ? "positive" : "negative"}
          />
          <MetricCard label={t("Transactions")} value={String(monthSummary.transactionCount)} icon="list" />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <ChartContainer title={t("Spending by category")} subtitle={monthLong(drill.month)} icon="tag">
            <CategoryBreakdownChart
              data={monthSlices}
              formatValue={(v) => formatMoney(Number(v ?? 0), { currency, maximumFractionDigits: 0 })}
              centerLabel={t("Spent")}
              centerValue={formatMoney(monthSummary.expenses, { currency, maximumFractionDigits: 0 })}
              height={240}
            />
          </ChartContainer>
          <ChartContainer
            title={t("View the ledger")}
            subtitle={t("These are the transactions behind this month")}
            icon="list"
            action={
              <Button variant="secondary" size="sm" icon="arrowRight" iconTrigger="click" onClick={() => onDrill(drill)}>
                {t("Open in table")}
              </Button>
            }
          >
            <p className="py-6 text-center text-[12.5px] text-fg-subtle">
              {t("{count} posted transactions in {month}. Open the table to edit, delete, or export them.", { count: monthSummary.transactionCount, month: monthLong(drill.month) })}
            </p>
          </ChartContainer>
        </div>
      </div>
    );
  }

  // --- Category drill-down context banner (the table is filtered in place) ---
  const categoryBanner =
    drill.categoryId && drill.categoryId !== "__other__" ? (
      <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-[var(--bg-subtle)]/60 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[12px] text-fg-muted">
          <AnimatedIcon name="tag" size={13} trigger="none" />
          {t("Showing")} <span className="font-medium text-fg">{drill.categoryName}</span> {t("across {year}", { year })}
        </span>
        <button
          type="button"
          onClick={() => onDrill({})}
          className="press inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] text-fg-muted hover:bg-[var(--surface-strong)] hover:text-fg"
        >
          {t("Clear")} <AnimatedIcon name="close" size={12} trigger="click" />
        </button>
      </div>
    ) : null;

  const exportCSV = () => {
    const csv = budgetReportCSV(summary, { periodLabel: year, currency });
    downloadFile(`gridhub-budget-${year}.csv`, csv, "text/csv");
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Year selector + actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ChartPeriodSelector
          options={yearOpts}
          value={year}
          onChange={setYear}
          ariaLabel={t("Select budget year")}
        />
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" icon="download" iconTrigger="click" onClick={exportCSV}>
            {t("Export")}
          </Button>
        </div>
      </div>

      {categoryBanner}

      {/* At-a-glance layout: date picker, category mix, and one consistent annual summary. */}
      <div className="grid items-stretch gap-3 xl:grid-cols-12">
        <BudgetCalendar transactions={transactions} year={year} onSelect={(date) => onDrill({ month: date.slice(0, 7), day: date })} />
        <div className="xl:col-span-5">{categoryDonut}</div>
        <section className="rounded-2xl border border-line bg-[var(--surface)] p-3 xl:col-span-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-semibold">{t("Year summary")}</h3>
            <span className="text-[11px] text-fg-subtle">{year}</span>
          </div>
          <div className="grid auto-rows-fr grid-cols-2 gap-2">
            <CompactMetric label={t("Income")} value={formatMoney(summary.income, { currency })} tone="positive" />
            <CompactMetric label={t("Expenses")} value={formatMoney(summary.expenses, { currency })} tone="negative" />
            <CompactMetric label={t("Net cash flow")} value={formatMoney(summary.netCashFlow, { currency, signed: true })} tone={summary.netCashFlow >= 0 ? "positive" : "negative"} />
            <CompactMetric label={t("Budget remaining")} value={formatMoney(budgetRemaining, { currency, signed: true })} hint={annualBudget ? t("of {amount}", { amount: formatMoney(annualBudget, { currency }) }) : t("No annual budget")} tone={budgetRemaining >= 0 ? "neutral" : "negative"} />
            <CompactMetric label={t("Savings rate")} value={formatPercent(summary.savingsRate)} hint={summary.savingsRate === null ? t("No income yet") : undefined} />
            <CompactMetric label={t("Transactions")} value={String(summary.transactionCount)} />
          </div>
        </section>
      </div>

      {/* Trends and budget comparisons sit below the at-a-glance row. */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartContainer
          title={t("Income vs expenses")}
          subtitle={t("{year} · all 12 months", { year })}
          icon="chart-column"
          action={
            <div className="flex items-center gap-2">
              <PinChartButton chartId="budget.monthly" title={t("Monthly income vs expenses")} tool="budget" />
              <span className="text-[11px] text-fg-subtle">{t("Tap a month to inspect it")}</span>
            </div>
          }
        >
          <MonthlyComparisonChart
            data={monthlyComparisonData(summary)}
            formatValue={chartFmt}
            onMonthClick={(m) => onDrill({ month: m })}
            selectedMonth={drill.month}
            height={260}
          />
        </ChartContainer>

        <ChartContainer
          title={t("Budget vs actual")}
          subtitle={t("Per category · red means overspent")}
          icon="target"
          action={<span className="text-[11px] text-fg-subtle">{annualBudget ? t("Annual") : t("No budget set")}</span>}
        >
          <BudgetVsActualChart
            data={baRows}
            formatValue={chartFmt}
            onCategoryClick={(name) => {
              const cat = categories.find((c) => c.name === name);
              if (cat) onDrill({ categoryId: cat.id, categoryName: cat.name });
            }}
            height={Math.max(180, baRows.length * 34 + 24)}
          />
        </ChartContainer>

        <ChartContainer title={t("Net cash flow trend")} subtitle={t("{year} · not savings balances", { year })} icon="trending-up">
          <TrendChart
            data={trend.map((row) => ({ label: row.label, net: row.net }))}
            xKey="label"
            series={[{ key: "net", name: t("Net cash flow") }]}
            formatValue={chartFmt}
            type="area"
            height={260}
          />
        </ChartContainer>
      </div>

      <BudgetInsights
        summary={summary}
        baRows={baRows}
        transactions={transactions}
        categories={categories}
        budgets={budgets}
        year={year}
        currency={currency}
      />
    </div>
  );
}

/* Annual reporting view (spec #4): totals, top categories, utilization, year-over-year. */
function BudgetInsights({
  summary,
  baRows,
  transactions,
  categories,
  budgets,
  year,
  currency,
}: {
  summary: ReturnType<typeof budgetSummary>;
  baRows: ReturnType<typeof annualBudgetVsActual>;
  transactions: MoneyTransaction[];
  categories: MoneyCategory[];
  budgets: MoneyBudget[];
  year: string;
  currency: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const fmt = (v: number) => formatMoney(v, { currency, maximumFractionDigits: 0 });

  // Year-over-year comparison only when the previous year actually has records (spec #24: no fake data).
  const prevSummary = React.useMemo(() => {
    const prevYear = String(Number(year) - 1);
    const hasPrev = transactions.some((tx) => tx.date.startsWith(prevYear));
    if (!hasPrev) return null;
    return budgetSummary({ transactions, categories, budgets, period: prevYear, currency });
  }, [transactions, categories, budgets, year, currency]);

  // Use the *annual* budget (from annualBudgetVsActual) so the bars compare a full year of
  // allocation against a full year of spend — not the single-month budget the summary keeps.
  const utilization = baRows.map((r) => ({
    id: r.category,
    label: r.category,
    value: r.actual,
    target: r.budget,
    over: r.budget > 0 && r.actual > r.budget,
  }));
  const topCats = topExpenseCategories(summary.byCategory, 6);

  return (
    <ChartContainer
      title={t("Annual insights")}
      subtitle={t("Totals, top categories and budget utilization")}
      icon="lightbulb"
      action={
        <Button variant="ghost" size="sm" icon={open ? "chevronUp" : "chevronDown"} iconTrigger="click" onClick={() => setOpen((v) => !v)}>
          {open ? t("Hide") : t("Show")}
        </Button>
      }
    >
      {open ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <Insight label={t("Total income")} value={fmt(summary.income)} />
            <Insight label={t("Total expenses")} value={fmt(summary.expenses)} />
            <Insight label={t("Net cash flow")} value={fmt(summary.netCashFlow)} />
            <Insight label={t("Avg monthly spend")} value={summary.avgMonthlySpending === null ? t("N/A") : fmt(summary.avgMonthlySpending)} />
            <Insight label={t("Complete months")} value={`${summary.completeMonths} / 12`} />
            <Insight label={t("Savings rate")} value={formatPercent(summary.savingsRate)} />
          </div>

          <div>
            <p className="mb-2 text-[12px] font-medium text-fg-muted">{t("Highest-spending categories")}</p>
            <div className="flex flex-col gap-1.5">
              {topCats.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="truncate">{c.label}</span>
                  <span className="tnum text-fg-muted">{fmt(c.value)}</span>
                </div>
              ))}
              {!topCats.length ? <p className="text-[12px] text-fg-subtle">{t("No spending yet.")}</p> : null}
            </div>
          </div>

          <div className="lg:col-span-2">
            <p className="mb-2 text-[12px] font-medium text-fg-muted">{t("Budget utilization")}</p>
            <div className="flex flex-col gap-2">
              {utilization.map((u) => {
                const pctVal = u.target > 0 ? Math.min(100, Math.round((u.value / u.target) * 100)) : 0;
                return (
                  <div key={u.id}>
                    <div className="mb-0.5 flex items-center justify-between gap-2 text-[12px]">
                      <span className="truncate">{u.label}</span>
                      <span className="tnum text-fg-muted">
                        {fmt(u.value)} / {fmt(u.target)}
                        {u.over ? <span className="ml-1 text-[var(--negative)]">{t("over")}</span> : null}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pctVal}%`, background: u.over ? "var(--negative)" : "var(--positive)" }}
                      />
                    </div>
                  </div>
                );
              })}
              {!utilization.length ? (
                <p className="text-[12px] text-fg-subtle">{t("Set monthly budgets to track utilization.")}</p>
              ) : null}
            </div>
          </div>

          {prevSummary ? (
            <div className="lg:col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-muted">
              <span>
                {t("Year over year: income {from} →", { from: fmt(prevSummary.income) })} <span className="text-fg">{fmt(summary.income)}</span>
              </span>
              <span>
                {t("expenses {from} →", { from: fmt(prevSummary.expenses) })} <span className="text-fg">{fmt(summary.expenses)}</span>
              </span>
              <span>
                {t("net {from} →", { from: fmt(prevSummary.netCashFlow) })} <span className="text-fg">{fmt(summary.netCashFlow)}</span>
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-[12px] text-fg-subtle">
          {t("{budgeted} budgeted categories · {spent} with spending · expand for the full breakdown.", { budgeted: baRows.length, spent: topCats.length })}
        </p>
      )}
    </ChartContainer>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-[var(--bg-subtle)]/40 p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-fg-subtle">{label}</p>
      <p className="tnum text-[15px] font-semibold">{value}</p>
    </div>
  );
}

function BudgetCalendar({
  transactions,
  year,
  onSelect,
}: {
  transactions: MoneyTransaction[];
  year: string;
  onSelect: (date: string) => void;
}) {
  const { t } = useI18n();
  const [month, setMonth] = React.useState(() => {
    const current = currentMonth();
    return current.startsWith(year) ? current : `${year}-01`;
  });
  const selectedMonth = month.startsWith(year) ? month : `${year}-01`;
  const [yyyy, mm] = selectedMonth.split("-").map(Number);
  const first = new Date(yyyy, mm - 1, 1);
  const offset = first.getDay();
  const daysInMonth = new Date(yyyy, mm, 0).getDate();
  const transactionDays = new Set(transactions.filter((transaction) => transaction.date.startsWith(selectedMonth)).map((transaction) => transaction.date));
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day < 1 || day > daysInMonth ? null : `${selectedMonth}-${String(day).padStart(2, "0")}`;
  });
  const moveMonth = (amount: number) => {
    const next = new Date(yyyy, mm - 1 + amount, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <section className="rounded-2xl border border-line bg-[var(--surface)] p-3 xl:col-span-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold">{t("Transaction calendar")}</h3>
        <div className="flex items-center gap-1">
          <button type="button" aria-label={t("Previous month")} disabled={selectedMonth === `${year}-01`} className="press grid h-7 w-7 place-items-center rounded-lg text-fg-muted hover:bg-[var(--surface-strong)] disabled:opacity-35" onClick={() => moveMonth(-1)}><AnimatedIcon name="chevronLeft" size={14} trigger="click" /></button>
          <span className="min-w-[5.5rem] text-center text-[10.5px] text-fg-muted">{new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
          <button type="button" aria-label={t("Next month")} disabled={selectedMonth === `${year}-12`} className="press grid h-7 w-7 place-items-center rounded-lg text-fg-muted hover:bg-[var(--surface-strong)] disabled:opacity-35" onClick={() => moveMonth(1)}><AnimatedIcon name="chevronRight" size={14} trigger="click" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center">
        {Array.from({ length: 7 }, (_, day) => <span key={day} className="py-1 text-[9px] font-medium text-fg-subtle">{new Date(2024, 0, 7 + day).toLocaleDateString(undefined, { weekday: "narrow" })}</span>)}
        {cells.map((date, index) => date ? (
          <button key={date} type="button" onClick={() => onSelect(date)} title={transactionDays.has(date) ? t("{date} · transactions", { date }) : date} className={`relative mx-auto grid h-7 w-7 place-items-center rounded-full text-[10.5px] hover:bg-[var(--surface-strong)] ${date === todayISO() ? "bg-[var(--accent)] font-semibold text-[var(--accent-fg)]" : "text-fg"}`}>
            {Number(date.slice(-2))}
            {transactionDays.has(date) ? <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[var(--accent)]" /> : null}
          </button>
        ) : <span key={`empty-${index}`} className="h-7" />)}
      </div>
      <p className="mt-1 text-[9.5px] text-fg-subtle">{t("Dots mark activity · select a day to filter the ledger")}</p>
    </section>
  );
}

function ProjectsBoard({ data }: { data: DataMap }) {
  const { t } = useI18n();
  const tasks = rows<Task>(data, "tasks");
  const [movingTaskIds, setMovingTaskIds] = React.useState<Set<string>>(() => new Set());
  if (!tasks.length) return null;

  const moveTask = async (task: Task, status: Task["status"]) => {
    if (movingTaskIds.has(task.id)) return;
    setMovingTaskIds((current) => new Set(current).add(task.id));
    try {
      const updated = await updateRecord<Task>("projects", "tasks", task.id, {
        status,
        ...(status === "done" ? { completedAt: todayISO() } : { completedAt: undefined }),
      });
      if (!updated) toast.error(t("Task could not be moved."));
    } catch {
      toast.error(t("Task could not be moved."));
    } finally {
      setMovingTaskIds((current) => {
        const next = new Set(current);
        next.delete(task.id);
        return next;
      });
    }
  };

  const orderedTasks = [...tasks].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate) || a.order - b.order;
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return a.order - b.order;
  });

  return (
    <Panel title={t("Board")} description={t("Move work with the arrow buttons — fully keyboard accessible")} icon="kanban">
      <div className="thin-scroll grid gap-2 overflow-x-auto sm:grid-cols-2 lg:grid-cols-4">
        {KANBAN_COLUMNS.map((col) => {
          const items = orderedTasks.filter((task) => task.status === col.id);
          return (
            <div key={col.id} className="rounded-xl border border-line bg-[var(--bg-subtle)]/40 p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-fg-subtle">{t(col.label)}</p>
                <span className="tnum text-[11px] text-fg-subtle">{items.length}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {items.map((task) => {
                  const statusIndex = KANBAN_COLUMNS.findIndex((column) => column.id === task.status);
                  const isMoving = movingTaskIds.has(task.id);
                  return (
                  <div key={task.id} className="rounded-lg border border-line bg-[var(--surface-strong)] p-2">
                    <p className="text-[12.5px] leading-snug">{task.title}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10.5px] text-fg-subtle">{task.dueDate ?? t("No due date")}</span>
                      <span className="flex items-center gap-1">
                        <button type="button" disabled={statusIndex <= 0 || isMoving} aria-label={t("Move to {status}", { status: t(KANBAN_COLUMNS[statusIndex - 1]?.label ?? "To do") })} title={t("Move to {status}", { status: t(KANBAN_COLUMNS[statusIndex - 1]?.label ?? "To do") })} onClick={() => { const previous = KANBAN_COLUMNS[statusIndex - 1]; if (previous) void moveTask(task, previous.id); }} className="grid h-6 w-6 place-items-center rounded-md text-fg-subtle hover:bg-[var(--surface)] hover:text-fg disabled:pointer-events-none disabled:opacity-30">
                          <AnimatedIcon name="chevronLeft" size={12} trigger="click" />
                        </button>
                        <button type="button" disabled={statusIndex < 0 || statusIndex >= KANBAN_COLUMNS.length - 1 || isMoving} aria-label={t("Move to {status}", { status: t(KANBAN_COLUMNS[statusIndex + 1]?.label ?? "Done") })} title={t("Move to {status}", { status: t(KANBAN_COLUMNS[statusIndex + 1]?.label ?? "Done") })} onClick={() => { const next = KANBAN_COLUMNS[statusIndex + 1]; if (next) void moveTask(task, next.id); }} className="grid h-6 w-6 place-items-center rounded-md text-fg-subtle hover:bg-[var(--surface)] hover:text-fg disabled:pointer-events-none disabled:opacity-30">
                          <AnimatedIcon name="chevronRight" size={12} trigger="click" />
                        </button>
                      </span>
                    </div>
                  </div>
                  );
                })}
                {!items.length ? <p className="px-1 py-3 text-[11.5px] text-fg-subtle">{t("Empty")}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function HabitGrid({ data }: { data: DataMap }) {
  const { t } = useI18n();
  const habits = rows<Habit>(data, "habits");
  const completions = rows<HabitCompletion>(data, "completions");
  if (!habits.length) return null;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  return (
    <Panel title={t("Last seven days")} description={t("Only scheduled days count toward streaks")} icon="circle-check">
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr>
              <th className="pb-2 text-left text-[11px] font-medium text-fg-subtle">{t("Habit")}</th>
              {days.map((d) => (
                <th key={d} className="pb-2 text-center text-[10.5px] font-medium text-fg-subtle">
                  {new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {habits.map((habit) => {
              const done = new Set(completions.filter((c) => c.habitId === habit.id).map((c) => c.date));
              return (
                <tr key={habit.id} className="border-t border-line">
                  <td className="py-2 pr-3">{habit.name}</td>
                  {days.map((d) => {
                    const scheduled = isScheduled(habit, d);
                    const complete = done.has(d);
                    return (
                      <td key={d} className="py-2 text-center">
                        <span
                          className="inline-grid h-5 w-5 place-items-center rounded-full border"
                          style={{
                            borderColor: complete ? "var(--accent)" : "var(--border-strong)",
                            background: complete ? "var(--accent)" : scheduled ? "transparent" : "var(--bg-subtle)",
                            color: complete ? "var(--accent-fg)" : "var(--fg-subtle)",
                          }}
                          title={`${habit.name} · ${d}${scheduled ? "" : t(" (not scheduled)")}`}
                        >
                          {complete ? <AnimatedIcon name="check" size={10} trigger="none" /> : null}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function NutritionDiary({ data }: { data: DataMap }) {
  const { t } = useI18n();
  const logs = rows<NutritionLog>(data, "logs");
  const today = todayISO();
  const totals = dailyTotals(logs, today);
  if (!logs.length) return null;
  const split = macroSplit(totals);

  return (
    <Panel title={t("Today")} description={t("Your private food diary — never shared, never analyzed elsewhere")} icon="utensils">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("Calories"), value: `${Math.round(totals.kcal)}`, unit: t("kcal") },
          { label: t("Protein"), value: `${totals.protein}`, unit: `g · ${formatPercent(split.protein, 0)}` },
          { label: t("Carbs"), value: `${totals.carbs}`, unit: `g · ${formatPercent(split.carbs, 0)}` },
          { label: t("Fat"), value: `${totals.fat}`, unit: `g · ${formatPercent(split.fat, 0)}` },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-line bg-[var(--bg-subtle)]/40 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-fg-subtle">{m.label}</p>
            <p className="tnum text-lg font-semibold">{m.value}</p>
            <p className="text-[10.5px] text-fg-subtle">{m.unit}</p>
          </div>
        ))}
      </div>
      {totals.entries === 0 ? (
        <p className="mt-3 text-[12px] text-fg-subtle">{t("Nothing logged today yet.")}</p>
      ) : null}
      <div className="mt-3 border-t border-line pt-3">
        <h3 className="mb-1 text-[11px] font-medium text-fg-muted">{t("Macros by grams")}</h3>
        <HorizontalRankingChart
          data={[
            { id: "protein", label: t("Protein"), value: totals.protein },
            { id: "carbs", label: t("Carbs"), value: totals.carbs },
            { id: "fat", label: t("Fat"), value: totals.fat },
          ]}
          formatValue={(value) => t("{grams} g", { grams: Math.round(Number(value ?? 0)) })}
          height={150}
        />
      </div>
    </Panel>
  );
}

function InvoicingOverview({ data, currency }: { data: DataMap; currency: string }) {
  const { t } = useI18n();
  const invoices = rows<Invoice>(data, "invoices").filter((invoice) => (invoice.currency || "USD") === currency);
  const invoiceIds = new Set(invoices.map((invoice) => invoice.id));
  const payments = rows<Payment>(data, "payments").filter((payment) => invoiceIds.has(payment.invoiceId));
  if (!invoices.length) return null;
  const summary = invoicingSummary(invoices, payments);
  const aging = { Current: 0, "1–30 days": 0, "31–60 days": 0, "61+ days": 0 };
  const today = new Date(`${todayISO()}T00:00:00`).getTime();
  for (const row of summary.rows) {
    if (row.totals.balanceDue <= 0) continue;
    const due = new Date(`${row.invoice.dueDate}T00:00:00`).getTime();
    const daysLate = Number.isFinite(due) ? Math.max(0, Math.floor((today - due) / 86_400_000)) : 0;
    const bucket = daysLate === 0 ? "Current" : daysLate <= 30 ? "1–30 days" : daysLate <= 60 ? "31–60 days" : "61+ days";
    aging[bucket] += row.totals.balanceDue;
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
    <Panel title={t("Receivables")} description={t("Balance due per invoice, computed with decimal-safe rounding")} icon="file-text">
      <div className="flex flex-col gap-2">
        {summary.rows.filter((row) => row.totals.balanceDue > 0).slice(0, 6).map((row) => (
          <div key={row.invoice.id} className="flex items-center justify-between gap-2 border-b border-line pb-2 last:border-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{row.invoice.number}</p>
              <p className="text-[11.5px] text-fg-subtle">
                {t("Due {date}", { date: row.invoice.dueDate })}
                {row.totals.isOverdue ? t(" · {count} days overdue", { count: row.totals.overdueDays }) : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="tnum text-[13px] font-medium">{formatMoney(row.totals.balanceDue, { currency })}</p>
              <Badge tone={row.totals.isOverdue ? "negative" : row.totals.balanceDue <= 0 ? "positive" : "neutral"}>
                {t(row.totals.status)}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Panel>
    <ChartContainer title={t("Receivables aging")} subtitle={t("Outstanding balances by days past due")} icon="clock">
      <HorizontalRankingChart data={Object.entries(aging).map(([label, value]) => ({ id: label, label: t(label), value }))} formatValue={(value) => formatMoney(Number(value ?? 0), { currency, maximumFractionDigits: 0 })} height={190} />
    </ChartContainer>
    </div>
  );
}

/* ==========================================================================
   Metrics
   ========================================================================== */

function computeMetrics(
  toolId: ToolId,
  data: DataMap,
  currency: string,
  t: (source: string, values?: Record<string, string | number>) => string,
  selectedScenarioId: string | null = null,
) {
  const m = (label: string, value: string, icon: string, hint?: string, tone?: "neutral" | "positive" | "negative" | "warning") => ({
    label,
    value,
    icon,
    hint,
    tone,
  });

  switch (toolId) {
    case "budget": {
      const s = budgetSummary({
        transactions: rows<MoneyTransaction>(data, "transactions"),
        categories: rows<MoneyCategory>(data, "categories"),
        budgets: rows<MoneyBudget>(data, "budgets"),
        period: currentMonth(),
        currency,
      });
      return [
        m(t("Income this month"), formatMoney(s.income, { currency }), "arrowUp", t("{count} transactions", { count: s.transactionCount })),
        m(t("Expenses"), formatMoney(s.expenses, { currency }), "arrowDown", undefined, "negative"),
        m(t("Net cash flow"), formatMoney(s.netCashFlow, { currency, signed: true }), "wallet", t("{percent} savings rate", { percent: formatPercent(s.savingsRate) }), s.netCashFlow >= 0 ? "positive" : "negative"),
        m(t("Budget remaining"), formatMoney(s.budgetRemaining, { currency }), "target", s.budgetAllocation ? t("of {amount}", { amount: formatMoney(s.budgetAllocation, { currency }) }) : t("No budget set"), s.budgetRemaining >= 0 ? "neutral" : "warning"),
      ];
    }
    case "paycheck": {
      const checks = rows<Paycheck>(data, "paychecks").sort((a, b) => b.date.localeCompare(a.date));
      const allocs = rows<PaycheckAllocation>(data, "allocations");
      const latest = checks[0];
      if (!latest) return [m(t("Paychecks"), t("None yet"), "calendar-days", t("Add a paycheck to start"))];
      const s = paycheckSummary(latest, allocs, { currency });
      return [
        m(t("Available balance"), formatMoney(s.available, { currency }), "wallet", latest.date),
        m(t("Bills assigned"), formatMoney(s.plannedBills + s.paidBills, { currency }), "receipt"),
        m(t("Planned spending"), formatMoney(s.plannedSpending, { currency }), "cart"),
        m(t("Daily allowance"), s.dailyAllowance ? formatMoney(s.dailyAllowance, { currency }) : "—", "gauge", s.daysUntilNextPaycheck ? t("{count} days left", { count: s.daysUntilNextPaycheck }) : undefined),
      ];
    }
    case "debt": {
      const debts = rows<Debt>(data, "debts");
      const totals = debtTotals(debts);
      const sim = simulateDebt(
        debts.map((d) => ({ id: d.id, name: d.name, balance: d.openingPrincipal, annualRate: d.annualRate, minimumPayment: d.minimumPayment })),
        round2(debts.reduce((a, d) => a + (d.extraPayment ?? 0), 0)),
        "snowball",
      );
      return [
        m(t("Total debt"), formatMoney(totals.balance, { currency }), "trending-down", t("{count} accounts", { count: totals.count })),
        m(t("Minimums"), formatMoney(totals.minimums, { currency }), "receipt"),
        m(t("Debt-free estimate"), totals.count ? sim.payoffDate : "—", "target", totals.count ? t("{count} months", { count: sim.months }) : undefined),
        m(t("Projected interest"), totals.count ? formatMoney(sim.totalInterest, { currency }) : "—", "percent", undefined, "warning"),
      ];
    }
    case "savings": {
      const s = savingsTotals(rows<SavingsGoal>(data, "goals"), rows<GoalMovement>(data, "movements"));
      return [
        m(t("Total saved"), formatMoney(s.balance, { currency }), "piggy-bank", undefined, "positive"),
        m(t("Combined target"), formatMoney(s.target, { currency }), "target"),
        m(t("Progress"), formatPercent(s.progressPct), "gauge"),
        m(t("Emergency cover"), s.emergencyMonths ? t("{count} months", { count: s.emergencyMonths }) : "—", "shield"),
      ];
    }
    case "net-worth": {
      const s = netWorthSummary(
        rows<NetWorthItem>(data, "items"),
        rows<Holding>(data, "holdings"),
        rows<ValuationSnapshot>(data, "snapshots"),
        currency,
      );
      return [
        m(t("Net worth"), formatMoney(s.netWorth, { currency }), "line-chart", undefined, s.netWorth >= 0 ? "positive" : "negative"),
        m(t("Assets"), formatMoney(s.assets, { currency }), "bank"),
        m(t("Liabilities"), formatMoney(s.liabilities, { currency }), "receipt", undefined, "negative"),
        m(t("Unrealized gain"), formatMoney(s.unrealizedGain, { currency, signed: true }), "trendingUp", formatPercent(s.unrealizedGainPct), s.unrealizedGain >= 0 ? "positive" : "negative"),
      ];
    }
    case "bookkeeping": {
      const tx = rows<BusinessTransaction>(data, "transactions").filter((row) => !row.deleted);
      const s = bookkeepingSummary(tx);
      return [
        m(t("Total revenue"), formatMoney(s.cashRevenue, { currency }), "arrowUp", t("Cash basis · collected revenue"), "positive"),
        m(t("Total expenses"), formatMoney(s.operatingExpenses, { currency }), "arrowDown", t("Cash basis · recorded expenses"), "negative"),
        m(t("Net profit / loss"), formatMoney(s.operatingSurplus, { currency, signed: true }), "wallet", t("Revenue less operating expenses"), s.operatingSurplus >= 0 ? "positive" : "negative"),
        m(t("Profit margin"), s.cashRevenue > 0 ? formatPercent(100 - (s.expenseRatio ?? 0)) : "—", "percent", t("Unavailable with zero revenue")),
        m(t("Uncategorized"), String(tx.filter((row) => (row.type === "revenue" || row.type === "expense") && !row.categoryId).length), "tag", t("Revenue and expense entries")),
        m(t("Cash received"), formatMoney(s.inflows, { currency }), "dollar", t("Includes capital and loan proceeds")),
      ];
    }
    case "inventory": {
      const products = rows<BusinessProduct>(data, "products").filter((row) => !row.deleted);
      const movements = rows<InventoryMovement>(data, "movements").filter((row) => !row.deleted);
      const s = inventorySummary(products, movements);
      return [
        m(t("Active SKUs"), String(s.productCount), "package", t("Non-deleted products")),
        m(t("Units in stock"), String(s.totalUnits), "boxes", t("Current on-hand quantity")),
        m(t("Inventory at cost"), formatMoney(s.inventoryValue, { currency }), "wallet", t("Moving weighted-average cost")),
        m(t("Low stock"), String(s.lowStock.length), "alert", t("At or below reorder threshold"), s.lowStock.length ? "warning" : "positive"),
        m(t("Out of stock"), String(products.filter((row) => row.quantity <= 0).length), "package", t("Current quantity at or below zero")),
        m(t("Stock movements"), String(movements.length), "repeat", t("Recorded movement history")),
      ];
    }
    case "sales": {
      const sales = rows<Sale>(data, "sales").filter((row) => !row.deleted && (row.currency || "USD") === currency);
      const current = currentMonth();
      const previousDate = new Date(current + "-01T00:00:00");
      previousDate.setMonth(previousDate.getMonth() - 1);
      const previous = previousDate.toISOString().slice(0, 7);
      const s = salesSummary(sales, rows<SalesTarget>(data, "targets").filter((row) => (row.currency || "USD") === currency), { period: current, priorPeriod: previous });
      return [
        m(t("Sales revenue"), formatMoney(s.net, { currency }), "shopping-cart", t("{count} sales this month", { count: s.orders })),
        m(t("Number of sales"), String(s.orders), "receipt", t("This month")),
        m(t("Average order"), s.averageOrderValue ? formatMoney(s.averageOrderValue, { currency }) : "—", "receipt", t("This month")),
        m(t("Revenue growth"), formatPercent(s.growth), "trendingUp", s.priorNet ? t("Compared with previous month") : t("No prior-month sales to compare")),
        m(t("Units sold"), String(s.unitsSold), "boxes", t("This month")),
        m(t("Returns"), formatMoney(metricSum(sales.filter((row) => row.date.startsWith(current)).map((row) => row.returned)), { currency }), "rotateCcw", t("Recorded this month")),
      ];
    }
    case "invoicing": {
      const invoices = rows<Invoice>(data, "invoices").filter((row) => !row.deleted && (row.currency || "USD") === currency);
      const invoiceIds = new Set(invoices.map((row) => row.id));
      const s = invoicingSummary(invoices, rows<Payment>(data, "payments").filter((row) => invoiceIds.has(row.invoiceId)), todayISO());
      const issuedRows = s.rows.filter((row) => row.invoice.status !== "draft" && row.invoice.status !== "void");
      const invoiced = metricSum(issuedRows.map((row) => row.totals.total));
      const paid = metricSum(issuedRows.map((row) => row.totals.paid));
      return [
        m(t("Total invoiced"), formatMoney(invoiced, { currency }), "file-text", t("Sent or settled invoices")),
        m(t("Payments collected"), formatMoney(paid, { currency }), "dollar", t("Linked invoice payments"), "positive"),
        m(t("Outstanding balance"), formatMoney(s.outstanding, { currency }), "wallet", t("Current amount due")),
        m(t("Overdue balance"), formatMoney(s.overdueAmount, { currency }), "alert", t("{count} invoices", { count: s.overdue.length }), s.overdueAmount > 0 ? "negative" : "positive"),
        m(t("Unpaid invoices"), String(issuedRows.filter((row) => row.totals.balanceDue > 0).length), "clock", t("Includes partial balances")),
        m(t("Collection rate"), invoiced > 0 ? formatPercent(paid / invoiced * 100) : "—", "gauge", t("Collected / total invoiced")),
      ];
    }
    case "cash-flow": {
      const scenarios = rows<CashScenario>(data, "scenarios").filter((row) => !row.deleted);
      const scenario = selectedScenarioId ? scenarios.find((row) => row.id === selectedScenarioId) : undefined;
      if (!scenario) return [m(t("Forecast scenarios"), String(scenarios.length), "waves", t("Select a forecast to view its financial metrics"))];
      const items = rows<CashForecastItem>(data, "items").filter((row) => row.scenarioId === scenario.id);
      const f = forecastCashFlow(items, scenario, { weeks: 13 });
      return [
        m(t("Opening cash"), formatMoney(scenario.openingCash, { currency }), "wallet", t("Saved scenario balance")),
        m(t("Forecast inflows"), formatMoney(metricSum(f.weeks.map((week) => week.inflows)), { currency }), "arrowUp", t("Certainty-weighted · 13 weeks")),
        m(t("Forecast outflows"), formatMoney(metricSum(f.weeks.map((week) => week.outflows)), { currency }), "arrowDown", t("Certainty-weighted · 13 weeks")),
        m(t("Projected closing"), formatMoney(f.closingCash, { currency }), "waves", t("After 13 forecast weeks"), f.closingCash >= 0 ? "positive" : "negative"),
        m(t("Lowest projected"), formatMoney(f.lowestCash, { currency }), "gauge", t("Across forecast weeks"), f.lowestCash < scenario.minimumCash ? "warning" : "neutral"),
        m(t("Cash shortfall"), formatMoney(f.shortfall, { currency }), "alert", t("Below configured minimum"), f.shortfall > 0 ? "negative" : "positive"),
      ];
    }
    case "wedding": {
      const wedding = (data["wedding"] ?? [])[0] as unknown as { eventDate?: string; totalBudget?: number } | undefined;
      const s = weddingSummary({
        eventDate: wedding?.eventDate ?? todayISO(),
        totalBudget: wedding?.totalBudget ?? 0,
        expenses: rows<WeddingExpense>(data, "expenses"),
        guests: rows<WeddingGuest>(data, "guests"),
        vendors: rows<WeddingVendor>(data, "vendors"),
        payments: rows<WeddingPayment>(data, "payments"),
        tables: rows<WeddingTable>(data, "tables"),
      });
      return [
        m(t("Days to go"), String(s.daysUntil), "clock", wedding?.eventDate ?? t("Set the date")),
        m(t("Budget remaining"), formatMoney(s.budgetRemaining, { currency }), "wallet", t("{amount} committed", { amount: formatMoney(s.committed, { currency }) }), s.overBudget ? "negative" : "neutral"),
        m(t("Guests accepted"), `${s.guestSeatsAccepted}`, "users", t("{percent} of invited", { percent: formatPercent(s.acceptanceRate) })),
        m(t("Vendor balance"), formatMoney(s.vendorOutstanding, { currency }), "briefcase"),
        m(t("Guests awaiting"), String(Math.max(0, s.guestSeatsInvited - s.guestSeatsAccepted - s.declined)), "users", t("Invited or tentative")),
        m(t("Tasks complete"), `${rows<WeddingTask>(data, "tasks").filter((row) => !row.deleted && row.done).length}/${rows<WeddingTask>(data, "tasks").filter((row) => !row.deleted).length}`, "circle-check", t("Recorded planning tasks")),
      ];
    }
    case "property": {
      const properties = rows<Property>(data, "properties").filter((row) => !row.deleted && (row.currency || "USD") === currency);
      const propertyIds = new Set(properties.map((row) => row.id));
      const propertyUnits = rows<PropertyUnit>(data, "units").filter((unit) => !unit.deleted && propertyIds.has(unit.propertyId));
      const bookings = rows<PropertyBooking>(data, "bookings").filter((row) => propertyIds.has(row.propertyId));
      const yearStart = todayISO().slice(0, 4) + "-01-01";
      const elapsedDays = Math.max(1, Math.floor((new Date(todayISO() + "T00:00:00").getTime() - new Date(yearStart + "T00:00:00").getTime()) / 86400000) + 1);
      const s = propertySummary({
        bookings,
        expenses: rows<PropertyExpense>(data, "expenses").filter((row) => propertyIds.has(row.propertyId)),
        maintenance: rows<PropertyMaintenance>(data, "maintenance").filter((row) => propertyIds.has(row.propertyId)),
        availableNights: elapsedDays * propertyUnits.length,
        period: todayISO().slice(0, 4),
      });
      return [
        m(t("Accommodation revenue"), formatMoney(s.accommodationRevenue, { currency }), "home"),
        m(t("Net operating income"), formatMoney(s.netOperatingIncome, { currency }), "wallet", undefined, s.netOperatingIncome >= 0 ? "positive" : "negative"),
        m(t("Occupancy"), formatPercent(s.occupancyRate), "gauge", t("{count} nights this year · year-to-date availability", { count: s.occupiedNights })),
        m(t("ADR"), s.adr ? formatMoney(s.adr, { currency }) : "—", "tag", s.revPan ? t("RevPAN {amount}", { amount: formatMoney(s.revPan, { currency }) }) : undefined),
        m(t("Properties"), String(properties.length), "home", t("In the selected currency")),
        m(t("Operating expenses"), formatMoney(s.operatingExpenses, { currency }), "receipt", t("Fees, cleaning and logged costs")),
      ];
    }
    case "nutrition": {
      const totals = dailyTotals(rows<NutritionLog>(data, "logs"), todayISO());
      return [
        m(t("Calories today"), String(Math.round(totals.kcal)), "utensils", t("{count} entries", { count: totals.entries })),
        m(t("Protein"), t("{grams} g", { grams: totals.protein }), "zap"),
        m(t("Carbs"), t("{grams} g", { grams: totals.carbs }), "coffee"),
        m(t("Fat"), t("{grams} g", { grams: totals.fat }), "droplet"),
        m(t("Fiber"), t("{grams} g", { grams: rows<NutritionLog>(data, "logs").filter((row) => !row.deleted && row.date === todayISO()).reduce((sum, row) => sum + (row.fiber ?? 0), 0) }), "leaf", t("From entries with saved fiber")),
        m(t("Entries today"), String(totals.entries), "receipt", t("Logged meals and foods")),
      ];
    }
    case "projects": {
      const s = projectProgress(rows<Task>(data, "tasks"));
      return [
        m(t("Active projects"), String(rows<Project>(data, "projects").filter((row) => !row.deleted && row.status === "active").length), "kanban", t("Current project status")),
        m(t("Open tasks"), String(s.remaining), "list", t("Not marked complete")),
        m(t("Completed tasks"), String(s.completed), "circle-check", t("Current completed status")),
        m(t("Overdue"), String(s.overdue), "alert", undefined, s.overdue ? "negative" : "positive"),
        m(t("Due this week"), String(rows<Task>(data, "tasks").filter((row) => !row.deleted && row.status !== "done" && row.dueDate && row.dueDate >= todayISO() && row.dueDate <= addDaysISO(todayISO(), 7)).length), "calendar-days", t("Next 7 days")),
        m(t("Completion"), formatPercent(s.completionPct), "kanban", t("{completed}/{total} tasks", { completed: s.completed, total: s.total })),
      ];
    }
    case "habits": {
      const s = habitsOverview(rows<Habit>(data, "habits"), rows<HabitCompletion>(data, "completions"));
      return [
        m(t("Active habits"), String(s.habits.length), "repeat", t("Not archived")),
        m(t("Done today"), `${s.doneToday}/${s.scheduledToday}`, "circle-check", t("Scheduled habits only"), "positive"),
        m(t("Weekly completion"), s.habits.length ? formatPercent(metricSum(s.habits.map((item) => item.stats.weekCompleted)) / Math.max(1, metricSum(s.habits.map((item) => item.stats.weekScheduled))) * 100) : "—", "gauge", t("Scheduled check-ins")),
        m(t("Current streak"), `${Math.max(0, ...s.habits.map((item) => item.stats.streak))}`, "zap", t("Schedule-aware")),
        m(t("Best streak"), `${s.bestStreak}`, "zap", t("scheduled days")),
        m(t("Remaining today"), String(Math.max(0, s.scheduledToday - s.doneToday)), "clock", t("Future check-ins excluded")),
      ];
    }
    case "content": {
      const s = contentSummary(rows<ContentPost>(data, "posts"), currentMonth());
      const posts = rows<ContentPost>(data, "posts").filter((row) => !row.deleted);
      const publications = rows<ContentPublication>(data, "publications").filter((row) => !row.deleted);
      const publishedPostIds = new Set(publications.map((row) => row.contentId));
      const legacyPosts = posts.filter((post) => !publishedPostIds.has(post.id));
      const scheduled = publications.filter((row) => row.status === "scheduled").length + legacyPosts.filter((row) => row.status === "scheduled").length;
      const published = publications.filter((row) => row.status === "published").length + legacyPosts.filter((row) => row.status === "published").length;
      const dueRecords = [
        ...publications.map((row) => ({ status: row.status, date: row.scheduledDate })),
        ...legacyPosts.map((row) => ({ status: row.status, date: row.scheduledDate })),
      ];
      const measuredPublications = publications.filter((row) => row.status === "published" && row.reach && row.reach > 0 && row.engagements !== undefined);
      const measuredLegacyPosts = legacyPosts.filter((row) => row.status === "published" && row.reach && row.reach > 0 && row.engagements !== undefined);
      const measuredReach = measuredPublications.length || measuredLegacyPosts.length
        ? metricSum([...measuredPublications.map((row) => row.reach ?? 0), ...measuredLegacyPosts.map((row) => row.reach ?? 0)])
        : s.totalReach;
      const measuredEngagements = measuredPublications.length || measuredLegacyPosts.length
        ? metricSum([...measuredPublications.map((row) => row.engagements ?? 0), ...measuredLegacyPosts.map((row) => row.engagements ?? 0)])
        : s.totalEngagements;
      return [
        m(t("Planned posts"), String(posts.length), "calendar-days", t("All saved content records")),
        m(t("Scheduled"), String(scheduled), "calendar-days", t("Destination-level and legacy schedules")),
        m(t("Published"), String(published), "circle-check", t("User-confirmed destination status")),
        m(t("Upcoming this week"), String(dueRecords.filter((row) => row.status === "scheduled" && row.date && row.date >= todayISO() && row.date <= addDaysISO(todayISO(), 7)).length), "clock", t("Per-channel scheduled date")),
        m(t("Overdue content"), String(dueRecords.filter((row) => row.status !== "published" && row.date && row.date < todayISO()).length), "alert", t("Past schedule; awaiting confirmation")),
        m(t("Engagement"), formatPercent(measuredReach ? (measuredEngagements / measuredReach) * 100 : null), "trendingUp", measuredReach ? t("{count} manually recorded reach", { count: measuredReach }) : t("No metrics recorded")),
      ];
    }
    default:
      return [];
  }
}

export { EmptyState, Button };
