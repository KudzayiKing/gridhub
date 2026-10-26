"use client";

import * as React from "react";
import { LedgerTool, Panel } from "./ledger-tool";
import { CompactMetric, MetricCard, Badge, EmptyState, InlineAlert } from "@/components/ui/card";
import { BarList, ProgressRing } from "@/components/charts/trend";
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
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { useToolData } from "@/lib/use-tool-data";
import { buildTabs } from "@/lib/tools";
import { rows } from "@/lib/tools/shared";
import { usePrefs } from "@/components/providers";
import { formatMoney, formatPercent, round2 } from "@/lib/money";
import { downloadFile } from "@/lib/utils";
import {
  currentMonth,
  currentYear,
  budgetSummary,
  simulateDebt,
  debtTotals,
  savingsTotals,
  netWorthSummary,
  goalSummary,
  paycheckSummary,
  nextPayDate,
} from "@/lib/calc/money";
import { bookkeepingSummary, inventorySummary, salesSummary, invoicingSummary, forecastCashFlow } from "@/lib/calc/business";
import { weddingSummary, propertySummary, dailyTotals, macroSplit, nightsBetween } from "@/lib/calc/life";
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
import type { ToolId } from "@/lib/catalog";
import type { DataMap } from "@/lib/tools/shared";
import type { BaseRecord } from "@/lib/types";
import type {
  CashForecastItem,
  CashScenario,
  ContentPost,
  Debt,
  GoalMovement,
  Habit,
  HabitCompletion,
  Invoice,
  MoneyAccount,
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
  RecurringBill,
  Sale,
  SalesTarget,
  SavingsGoal,
  Task,
  WeddingExpense,
  WeddingGuest,
  WeddingPayment,
  WeddingTable,
  WeddingVendor,
  BusinessTransaction,
  BusinessProduct,
  InventoryMovement,
  NetWorthItem,
  Holding,
  ValuationSnapshot,
  BusinessContact,
} from "@/lib/types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
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
  const { prefs } = usePrefs();
  const currency = prefs.currency || "USD";

  const [drill, setDrill] = React.useState<DrillState>({});
  const [requestedTab, setRequestedTab] = React.useState<string | undefined>();

  const tabs = React.useMemo(() => buildTabs(toolId, data), [toolId, data]);
  // These overviews already contain the complete summary, so showing LedgerTool's
  // headline cards above them repeats the same figures with a second time period.
  const metrics = React.useMemo(
    () => (toolId === "budget" || toolId === "debt" || toolId === "savings" || toolId === "nutrition" ? [] : computeMetrics(toolId, data, currency)),
    [toolId, data, currency],
  );
  const displayTabs = React.useMemo(() => applyDrill(tabs, drill, toolId), [tabs, drill, toolId]);

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

  return (
    <LedgerTool
      toolId={toolId}
      tabs={displayTabs}
      metrics={metrics.map((m) => (
        <MetricCard key={m.label} label={m.label} value={m.value} hint={m.hint} icon={m.icon} tone={m.tone} />
      ))}
      overview={
        <Overview toolId={toolId} data={data} currency={currency} drill={drill} onDrill={setDrill} onOpenTab={setRequestedTab} />
      }
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
}: {
  toolId: ToolId;
  data: DataMap;
  currency: string;
  drill: DrillState;
  onDrill: (next: DrillState) => void;
  onOpenTab: (tab: string) => void;
}) {
  switch (toolId) {
    case "paycheck":
      return <PaycheckDashboard data={data} currency={currency} onOpenAllocations={() => onOpenTab("allocations")} />;
    case "budget":
      return <BudgetOverview data={data} currency={currency} drill={drill} onDrill={onDrill} />;
    case "debt":
      return <DebtDashboard currency={currency} />;
    case "savings":
      return <SavingsOverview data={data} currency={currency} />;
    case "projects":
      return <ProjectsBoard data={data} />;
    case "habits":
      return <HabitGrid data={data} />;
    case "nutrition":
      return <NutritionDiary data={data} />;
    case "invoicing":
      return <InvoicingOverview data={data} currency={currency} />;
    case "net-worth":
    case "bookkeeping":
    case "inventory":
    case "sales":
    case "cash-flow":
    case "wedding":
    case "property":
    case "content":
      return <ToolCharts toolId={toolId} data={data} currency={currency} />;
    default:
      return null;
  }
}

function ToolCharts({ toolId, data, currency }: { toolId: ToolId; data: DataMap; currency: string }) {
  const money = (value: number | string | undefined) => formatMoney(Number(value ?? 0), { currency, maximumFractionDigits: 0 });
  if (toolId === "net-worth") {
    const snapshots = rows<ValuationSnapshot>(data, "snapshots").sort((a, b) => a.date.localeCompare(b.date));
    if (snapshots.length < 2) return null;
    return <ChartContainer title="Net worth history" subtitle="Recorded asset and liability snapshots" icon="line-chart"><TrendChart data={snapshots.map((item) => ({ label: item.date, assets: item.totalAssets, liabilities: item.totalLiabilities, net: item.totalAssets - item.totalLiabilities }))} xKey="label" series={[{ key: "assets", name: "Assets" }, { key: "liabilities", name: "Liabilities" }, { key: "net", name: "Net worth" }]} formatValue={money} type="line" height={240} /></ChartContainer>;
  }
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
    return <ChartContainer title="Business income and expenses" subtitle="Recorded revenue and operating expenses by month" icon="chart-column"><TrendChart data={trend} xKey="label" series={[{ key: "income", name: "Revenue" }, { key: "expenses", name: "Expenses" }]} formatValue={money} type="line" height={240} /></ChartContainer>;
  }
  if (toolId === "inventory") {
    const products = rows<BusinessProduct>(data, "products");
    if (!products.length) return null;
    return <ChartContainer title="Stock on hand" subtitle="Units by product · weighted average inventory tracking" icon="package"><HorizontalRankingChart data={products.map((product) => ({ id: product.id, label: product.name, value: product.quantity }))} formatValue={(value) => `${Number(value ?? 0)} units`} maxItems={10} height={Math.max(170, Math.min(products.length, 10) * 32 + 30)} /></ChartContainer>;
  }
  if (toolId === "sales") {
    const summary = salesSummary(rows<Sale>(data, "sales"), rows<SalesTarget>(data, "targets"));
    if (!summary.byMonth.length) return null;
    return <ChartContainer title="Sales revenue trend" subtitle="Net sales by month, after discounts and returns" icon="trending-up"><TrendChart data={summary.byMonth.map((item) => ({ label: monthLong(item.month), net: item.net }))} xKey="label" series={[{ key: "net", name: "Net sales" }]} formatValue={money} type="line" height={240} /></ChartContainer>;
  }
  if (toolId === "cash-flow") {
    const scenario = rows<CashScenario>(data, "scenarios")[0];
    if (!scenario) return null;
    const forecast = forecastCashFlow(rows<CashForecastItem>(data, "items"), scenario, { weeks: 13 });
    return <ChartContainer title="13-week cash forecast" subtitle="Projected closing balance with weekly inflows and outflows" icon="waves"><TrendChart data={forecast.weeks.map((week) => ({ label: new Date(`${week.label}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }), closing: week.closing, minimum: scenario.minimumCash }))} xKey="label" series={[{ key: "closing", name: "Closing cash" }, { key: "minimum", name: "Minimum cash" }]} formatValue={money} type="area" height={240} /></ChartContainer>;
  }
  if (toolId === "wedding") {
    const expenses = rows<WeddingExpense>(data, "expenses");
    if (!expenses.length) return null;
    return <ChartContainer title="Wedding spend by category" subtitle="Committed budget compared with actual spend" icon="heart"><TrendChart data={expenses.map((expense) => ({ label: expense.category, committed: expense.committed, actual: expense.actual }))} xKey="label" series={[{ key: "committed", name: "Committed" }, { key: "actual", name: "Actual" }]} formatValue={money} type="line" height={Math.max(200, Math.min(expenses.length, 8) * 35 + 50)} /></ChartContainer>;
  }
  if (toolId === "property") {
    const bookings = rows<PropertyBooking>(data, "bookings").filter((booking) => booking.status !== "cancelled");
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
    return <ChartContainer title="Property booking revenue" subtitle="Accommodation revenue by check-in month" icon="home"><TrendChart data={[...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, values]) => ({ label: monthLong(period), revenue: values.revenue }))} xKey="label" series={[{ key: "revenue", name: "Revenue" }]} formatValue={money} type="line" height={240} /></ChartContainer>;
  }
  if (toolId === "content") {
    const posts = rows<ContentPost>(data, "posts");
    if (!posts.length) return null;
    const statusOrder = ["idea", "draft", "scheduled", "published"] as const;
    const counts = statusOrder.map((status) => ({ id: status, label: status[0].toUpperCase() + status.slice(1), value: posts.filter((post) => post.status === status).length }));
    return <ChartContainer title="Publishing pipeline" subtitle="Content count by current status" icon="calendar-range"><HorizontalRankingChart data={counts} formatValue={(value) => `${Number(value ?? 0)} posts`} height={175} /></ChartContainer>;
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
  const transactions = rows<MoneyTransaction>(data, "transactions");
  const categories = rows<MoneyCategory>(data, "categories");
  const budgets = rows<MoneyBudget>(data, "budgets");

  const yearOpts = React.useMemo(
    () => yearOptions(transactions.map((t) => t.date), 6),
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
      title="Spending by category"
      subtitle="Donut · tap a slice to filter"
      icon="tag"
      action={<PinChartButton chartId="budget.categories" title="Spending by category" tool="budget" />}
    >
      <CategoryBreakdownChart
        data={slices}
        formatValue={chartFmt}
        centerLabel="Spent"
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
      <ChartEmptyState label="Add income and expenses to see your annual budget take shape" />
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
              Back to {year}
            </Button>
            <h2 className="text-[15px] font-semibold">{monthLong(drill.month)}</h2>
          </div>
          <PinChartButton chartId="budget.monthly" title="Monthly income vs expenses" tool="budget" />
        </div>

        <div className="grid auto-rows-fr grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <MetricCard label="Income" value={formatMoney(monthSummary.income, { currency })} icon="arrowUp" />
          <MetricCard label="Expenses" value={formatMoney(monthSummary.expenses, { currency })} icon="arrowDown" tone="negative" />
          <MetricCard
            label="Net cash flow"
            value={formatMoney(monthSummary.netCashFlow, { currency, signed: true })}
            icon="wallet"
            tone={monthSummary.netCashFlow >= 0 ? "positive" : "negative"}
          />
          <MetricCard label="Transactions" value={String(monthSummary.transactionCount)} icon="list" />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <ChartContainer title="Spending by category" subtitle={monthLong(drill.month)} icon="tag">
            <CategoryBreakdownChart
              data={monthSlices}
              formatValue={(v) => formatMoney(Number(v ?? 0), { currency, maximumFractionDigits: 0 })}
              centerLabel="Spent"
              centerValue={formatMoney(monthSummary.expenses, { currency, maximumFractionDigits: 0 })}
              height={240}
            />
          </ChartContainer>
          <ChartContainer
            title="View the ledger"
            subtitle="These are the transactions behind this month"
            icon="list"
            action={
              <Button variant="secondary" size="sm" icon="arrowRight" iconTrigger="click" onClick={() => onDrill(drill)}>
                Open in table
              </Button>
            }
          >
            <p className="py-6 text-center text-[12.5px] text-fg-subtle">
              {monthSummary.transactionCount} posted transaction
              {monthSummary.transactionCount === 1 ? "" : "s"} in {monthLong(drill.month)}.
              Open the table to edit, delete, or export them.
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
          Showing <span className="font-medium text-fg">{drill.categoryName}</span> across {year}
        </span>
        <button
          type="button"
          onClick={() => onDrill({})}
          className="press inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] text-fg-muted hover:bg-[var(--surface-strong)] hover:text-fg"
        >
          Clear <AnimatedIcon name="close" size={12} trigger="click" />
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
          ariaLabel="Select budget year"
        />
        <div className="flex items-center gap-1.5">
          <Button variant="secondary" size="sm" icon="download" iconTrigger="click" onClick={exportCSV}>
            Export
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
            <h3 className="text-[12px] font-semibold">Year summary</h3>
            <span className="text-[11px] text-fg-subtle">{year}</span>
          </div>
          <div className="grid auto-rows-fr grid-cols-2 gap-2">
            <CompactMetric label="Income" value={formatMoney(summary.income, { currency })} tone="positive" />
            <CompactMetric label="Expenses" value={formatMoney(summary.expenses, { currency })} tone="negative" />
            <CompactMetric label="Net cash flow" value={formatMoney(summary.netCashFlow, { currency, signed: true })} tone={summary.netCashFlow >= 0 ? "positive" : "negative"} />
            <CompactMetric label="Budget remaining" value={formatMoney(budgetRemaining, { currency, signed: true })} hint={annualBudget ? `of ${formatMoney(annualBudget, { currency })}` : "No annual budget"} tone={budgetRemaining >= 0 ? "neutral" : "negative"} />
            <CompactMetric label="Savings rate" value={formatPercent(summary.savingsRate)} hint={summary.savingsRate === null ? "No income yet" : undefined} />
            <CompactMetric label="Transactions" value={String(summary.transactionCount)} />
          </div>
        </section>
      </div>

      {/* Trends and budget comparisons sit below the at-a-glance row. */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartContainer
          title="Income vs expenses"
          subtitle={`${year} · all 12 months`}
          icon="chart-column"
          action={
            <div className="flex items-center gap-2">
              <PinChartButton chartId="budget.monthly" title="Monthly income vs expenses" tool="budget" />
              <span className="text-[11px] text-fg-subtle">Tap a month to inspect it</span>
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
          title="Budget vs actual"
          subtitle="Per category · red means overspent"
          icon="target"
          action={<span className="text-[11px] text-fg-subtle">{annualBudget ? "Annual" : "No budget set"}</span>}
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

        <ChartContainer title="Net cash flow trend" subtitle={`${year} · not savings balances`} icon="trending-up">
          <TrendChart
            data={trend.map((t) => ({ label: t.label, net: t.net }))}
            xKey="label"
            series={[{ key: "net", name: "Net cash flow" }]}
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
  const [open, setOpen] = React.useState(false);
  const fmt = (v: number) => formatMoney(v, { currency, maximumFractionDigits: 0 });

  // Year-over-year comparison only when the previous year actually has records (spec #24: no fake data).
  const prevSummary = React.useMemo(() => {
    const prevYear = String(Number(year) - 1);
    const hasPrev = transactions.some((t) => t.date.startsWith(prevYear));
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
      title="Annual insights"
      subtitle="Totals, top categories and budget utilization"
      icon="lightbulb"
      action={
        <Button variant="ghost" size="sm" icon={open ? "chevronUp" : "chevronDown"} iconTrigger="click" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Show"}
        </Button>
      }
    >
      {open ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <Insight label="Total income" value={fmt(summary.income)} />
            <Insight label="Total expenses" value={fmt(summary.expenses)} />
            <Insight label="Net cash flow" value={fmt(summary.netCashFlow)} />
            <Insight label="Avg monthly spend" value={summary.avgMonthlySpending === null ? "N/A" : fmt(summary.avgMonthlySpending)} />
            <Insight label="Complete months" value={`${summary.completeMonths} / 12`} />
            <Insight label="Savings rate" value={formatPercent(summary.savingsRate)} />
          </div>

          <div>
            <p className="mb-2 text-[12px] font-medium text-fg-muted">Highest-spending categories</p>
            <div className="flex flex-col gap-1.5">
              {topCats.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="truncate">{c.label}</span>
                  <span className="tnum text-fg-muted">{fmt(c.value)}</span>
                </div>
              ))}
              {!topCats.length ? <p className="text-[12px] text-fg-subtle">No spending yet.</p> : null}
            </div>
          </div>

          <div className="lg:col-span-2">
            <p className="mb-2 text-[12px] font-medium text-fg-muted">Budget utilization</p>
            <div className="flex flex-col gap-2">
              {utilization.map((u) => {
                const pctVal = u.target > 0 ? Math.min(100, Math.round((u.value / u.target) * 100)) : 0;
                return (
                  <div key={u.id}>
                    <div className="mb-0.5 flex items-center justify-between gap-2 text-[12px]">
                      <span className="truncate">{u.label}</span>
                      <span className="tnum text-fg-muted">
                        {fmt(u.value)} / {fmt(u.target)}
                        {u.over ? <span className="ml-1 text-[var(--negative)]">over</span> : null}
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
                <p className="text-[12px] text-fg-subtle">Set monthly budgets to track utilization.</p>
              ) : null}
            </div>
          </div>

          {prevSummary ? (
            <div className="lg:col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-muted">
              <span>
                Year over year: income {fmt(prevSummary.income)} → <span className="text-fg">{fmt(summary.income)}</span>
              </span>
              <span>
                expenses {fmt(prevSummary.expenses)} → <span className="text-fg">{fmt(summary.expenses)}</span>
              </span>
              <span>
                net {fmt(prevSummary.netCashFlow)} → <span className="text-fg">{fmt(summary.netCashFlow)}</span>
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-[12px] text-fg-subtle">
          {baRows.length} budgeted categories · {topCats.length} with spending · expand for the full breakdown.
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
  const [month, setMonth] = React.useState(() => {
    const current = currentMonth();
    return current.startsWith(year) ? current : `${year}-01`;
  });
  React.useEffect(() => {
    setMonth((current) => current.startsWith(year) ? current : `${year}-01`);
  }, [year]);

  const [yyyy, mm] = month.split("-").map(Number);
  const first = new Date(yyyy, mm - 1, 1);
  const offset = first.getDay();
  const daysInMonth = new Date(yyyy, mm, 0).getDate();
  const transactionDays = new Set(transactions.filter((transaction) => transaction.date.startsWith(month)).map((transaction) => transaction.date));
  const cells = Array.from({ length: Math.ceil((offset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - offset + 1;
    return day < 1 || day > daysInMonth ? null : `${month}-${String(day).padStart(2, "0")}`;
  });
  const moveMonth = (amount: number) => {
    const next = new Date(yyyy, mm - 1 + amount, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <section className="rounded-2xl border border-line bg-[var(--surface)] p-3 xl:col-span-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold">Transaction calendar</h3>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous month" disabled={month === `${year}-01`} className="press grid h-7 w-7 place-items-center rounded-lg text-fg-muted hover:bg-[var(--surface-strong)] disabled:opacity-35" onClick={() => moveMonth(-1)}><AnimatedIcon name="chevronLeft" size={14} trigger="click" /></button>
          <span className="min-w-[5.5rem] text-center text-[10.5px] text-fg-muted">{new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</span>
          <button type="button" aria-label="Next month" disabled={month === `${year}-12`} className="press grid h-7 w-7 place-items-center rounded-lg text-fg-muted hover:bg-[var(--surface-strong)] disabled:opacity-35" onClick={() => moveMonth(1)}><AnimatedIcon name="chevronRight" size={14} trigger="click" /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center">
        {Array.from({ length: 7 }, (_, day) => <span key={day} className="py-1 text-[9px] font-medium text-fg-subtle">{new Date(2024, 0, 7 + day).toLocaleDateString(undefined, { weekday: "narrow" })}</span>)}
        {cells.map((date, index) => date ? (
          <button key={date} type="button" onClick={() => onSelect(date)} title={transactionDays.has(date) ? `${date} · transactions` : date} className={`relative mx-auto grid h-7 w-7 place-items-center rounded-full text-[10.5px] hover:bg-[var(--surface-strong)] ${date === todayISO() ? "bg-[var(--accent)] font-semibold text-[var(--accent-fg)]" : "text-fg"}`}>
            {Number(date.slice(-2))}
            {transactionDays.has(date) ? <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-[var(--accent)]" /> : null}
          </button>
        ) : <span key={`empty-${index}`} className="h-7" />)}
      </div>
      <p className="mt-1 text-[9.5px] text-fg-subtle">Dots mark activity · select a day to filter the ledger</p>
    </section>
  );
}

function SavingsOverview({ data, currency }: { data: DataMap; currency: string }) {
  const goals = rows<SavingsGoal>(data, "goals");
  const movements = rows<GoalMovement>(data, "movements");
  if (!goals.length) return null;

  const summaries = goals.map((g) => goalSummary(g, movements));
  const monthlyMovements = new Map<string, number>();
  for (const movement of movements) {
    const period = movement.date.slice(0, 7);
    if (period) monthlyMovements.set(period, (monthlyMovements.get(period) ?? 0) + (movement.kind === "withdrawal" ? -movement.amount : movement.amount));
  }
  let balance = goals.reduce((total, goal) => total + goal.openingBalance, 0);
  const balanceTrend = [...monthlyMovements.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, change]) => {
    balance += change;
    return { label: monthLong(period), balance: Math.max(0, balance) };
  });

  return (
    <div className="grid gap-3 lg:grid-cols-2">
    <Panel title="Goal progress" description="Contributions minus withdrawals, against each target" icon="piggy-bank">
      <div className="flex flex-col gap-3">
        {summaries.map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <ProgressRing value={s.progressPct} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-[13px] font-medium">{s.name}</p>
                <p className="tnum text-[12.5px] text-fg-muted">
                  {formatMoney(s.balance, { currency })} / {formatMoney(s.target, { currency })}
                </p>
              </div>
              <p className="text-[11.5px] text-fg-subtle">
                {s.remaining <= 0
                  ? "Target reached"
                  : s.requiredMonthly
                    ? `${formatMoney(s.requiredMonthly, { currency })}/month to finish on time`
                    : `${formatMoney(s.remaining, { currency })} remaining`}
                {s.overdue ? " · target date passed" : ""}
                {s.monthsOfCover ? ` · ${s.monthsOfCover} months of cover` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Panel>
    <ChartContainer title="Savings balance over time" subtitle="Opening balances plus recorded contributions and withdrawals" icon="trending-up">
      <TrendChart data={balanceTrend} xKey="label" series={[{ key: "balance", name: "Total savings" }]} formatValue={(value) => formatMoney(Number(value ?? 0), { currency, maximumFractionDigits: 0 })} type="area" height={220} />
    </ChartContainer>
    </div>
  );
}

function ProjectsBoard({ data }: { data: DataMap }) {
  const tasks = rows<Task>(data, "tasks");
  if (!tasks.length) return null;

  return (
    <Panel title="Board" description="Move work with the arrow buttons — fully keyboard accessible" icon="kanban">
      <div className="thin-scroll grid gap-2 overflow-x-auto sm:grid-cols-2 lg:grid-cols-4">
        {KANBAN_COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className="rounded-xl border border-line bg-[var(--bg-subtle)]/40 p-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-fg-subtle">{col.label}</p>
                <span className="tnum text-[11px] text-fg-subtle">{items.length}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {items.slice(0, 5).map((task) => (
                  <div key={task.id} className="rounded-lg border border-line bg-[var(--surface-strong)] p-2">
                    <p className="text-[12.5px] leading-snug">{task.title}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10.5px] text-fg-subtle">{task.dueDate ?? "No due date"}</span>
                      <span className="flex items-center gap-1">
                        <AnimatedIcon name="chevronLeft" size={12} trigger="click" className="text-fg-subtle" />
                        <AnimatedIcon name="chevronRight" size={12} trigger="click" className="text-fg-subtle" />
                      </span>
                    </div>
                  </div>
                ))}
                {!items.length ? <p className="px-1 py-3 text-[11.5px] text-fg-subtle">Empty</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function HabitGrid({ data }: { data: DataMap }) {
  const habits = rows<Habit>(data, "habits");
  const completions = rows<HabitCompletion>(data, "completions");
  if (!habits.length) return null;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });

  return (
    <Panel title="Last seven days" description="Only scheduled days count toward streaks" icon="circle-check">
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr>
              <th className="pb-2 text-left text-[11px] font-medium text-fg-subtle">Habit</th>
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
                          title={`${habit.name} · ${d}${scheduled ? "" : " (not scheduled)"}`}
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
  const logs = rows<NutritionLog>(data, "logs");
  const today = todayISO();
  const totals = dailyTotals(logs, today);
  if (!logs.length) return null;
  const split = macroSplit(totals);

  return (
    <Panel title="Today" description="Your private food diary — never shared, never analyzed elsewhere" icon="utensils">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Calories", value: `${Math.round(totals.kcal)}`, unit: "kcal" },
          { label: "Protein", value: `${totals.protein}`, unit: `g · ${formatPercent(split.protein, 0)}` },
          { label: "Carbs", value: `${totals.carbs}`, unit: `g · ${formatPercent(split.carbs, 0)}` },
          { label: "Fat", value: `${totals.fat}`, unit: `g · ${formatPercent(split.fat, 0)}` },
        ].map((m) => (
          <div key={m.label} className="rounded-xl border border-line bg-[var(--bg-subtle)]/40 p-2.5">
            <p className="text-[11px] uppercase tracking-wide text-fg-subtle">{m.label}</p>
            <p className="tnum text-lg font-semibold">{m.value}</p>
            <p className="text-[10.5px] text-fg-subtle">{m.unit}</p>
          </div>
        ))}
      </div>
      {totals.entries === 0 ? (
        <p className="mt-3 text-[12px] text-fg-subtle">Nothing logged today yet.</p>
      ) : null}
      <div className="mt-3 border-t border-line pt-3">
        <h3 className="mb-1 text-[11px] font-medium text-fg-muted">Macros by grams</h3>
        <HorizontalRankingChart
          data={[
            { id: "protein", label: "Protein", value: totals.protein },
            { id: "carbs", label: "Carbs", value: totals.carbs },
            { id: "fat", label: "Fat", value: totals.fat },
          ]}
          formatValue={(value) => `${Math.round(Number(value ?? 0))} g`}
          height={150}
        />
      </div>
    </Panel>
  );
}

function InvoicingOverview({ data, currency }: { data: DataMap; currency: string }) {
  const invoices = rows<Invoice>(data, "invoices");
  const payments = rows<Payment>(data, "payments");
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
    <Panel title="Receivables" description="Balance due per invoice, computed with decimal-safe rounding" icon="file-text">
      <div className="flex flex-col gap-2">
        {summary.rows.filter((row) => row.totals.balanceDue > 0).slice(0, 6).map((row) => (
          <div key={row.invoice.id} className="flex items-center justify-between gap-2 border-b border-line pb-2 last:border-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{row.invoice.number}</p>
              <p className="text-[11.5px] text-fg-subtle">
                Due {row.invoice.dueDate}
                {row.totals.isOverdue ? ` · ${row.totals.overdueDays} days overdue` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="tnum text-[13px] font-medium">{formatMoney(row.totals.balanceDue, { currency })}</p>
              <Badge tone={row.totals.isOverdue ? "negative" : row.totals.balanceDue <= 0 ? "positive" : "neutral"}>
                {row.totals.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Panel>
    <ChartContainer title="Receivables aging" subtitle="Outstanding balances by days past due" icon="clock">
      <HorizontalRankingChart data={Object.entries(aging).map(([label, value]) => ({ id: label, label, value }))} formatValue={(value) => formatMoney(Number(value ?? 0), { currency, maximumFractionDigits: 0 })} height={190} />
    </ChartContainer>
    </div>
  );
}

/* ==========================================================================
   Metrics
   ========================================================================== */

function computeMetrics(toolId: ToolId, data: DataMap, currency: string) {
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
        m("Income this month", formatMoney(s.income, { currency }), "arrowUp", `${s.transactionCount} transactions`),
        m("Expenses", formatMoney(s.expenses, { currency }), "arrowDown", undefined, "negative"),
        m("Net cash flow", formatMoney(s.netCashFlow, { currency, signed: true }), "wallet", `${formatPercent(s.savingsRate)} savings rate`, s.netCashFlow >= 0 ? "positive" : "negative"),
        m("Budget remaining", formatMoney(s.budgetRemaining, { currency }), "target", s.budgetAllocation ? `of ${formatMoney(s.budgetAllocation, { currency })}` : "No budget set", s.budgetRemaining >= 0 ? "neutral" : "warning"),
      ];
    }
    case "paycheck": {
      const checks = rows<Paycheck>(data, "paychecks").sort((a, b) => b.date.localeCompare(a.date));
      const allocs = rows<PaycheckAllocation>(data, "allocations");
      const latest = checks[0];
      if (!latest) return [m("Paychecks", "None yet", "calendar-days", "Add a paycheck to start")];
      const s = paycheckSummary(latest, allocs, { currency });
      return [
        m("Available balance", formatMoney(s.available, { currency }), "wallet", latest.date),
        m("Bills assigned", formatMoney(s.plannedBills + s.paidBills, { currency }), "receipt"),
        m("Planned spending", formatMoney(s.plannedSpending, { currency }), "cart"),
        m("Daily allowance", s.dailyAllowance ? formatMoney(s.dailyAllowance, { currency }) : "—", "gauge", s.daysUntilNextPaycheck ? `${s.daysUntilNextPaycheck} days left` : undefined),
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
        m("Total debt", formatMoney(totals.balance, { currency }), "trending-down", `${totals.count} accounts`),
        m("Minimums", formatMoney(totals.minimums, { currency }), "receipt"),
        m("Debt-free estimate", totals.count ? sim.payoffDate : "—", "target", totals.count ? `${sim.months} months` : undefined),
        m("Projected interest", totals.count ? formatMoney(sim.totalInterest, { currency }) : "—", "percent", undefined, "warning"),
      ];
    }
    case "savings": {
      const s = savingsTotals(rows<SavingsGoal>(data, "goals"), rows<GoalMovement>(data, "movements"));
      return [
        m("Total saved", formatMoney(s.balance, { currency }), "piggy-bank", undefined, "positive"),
        m("Combined target", formatMoney(s.target, { currency }), "target"),
        m("Progress", formatPercent(s.progressPct), "gauge"),
        m("Emergency cover", s.emergencyMonths ? `${s.emergencyMonths} months` : "—", "shield"),
      ];
    }
    case "net-worth": {
      const s = netWorthSummary(
        rows<NetWorthItem>(data, "items"),
        rows<Holding>(data, "holdings"),
        rows<ValuationSnapshot>(data, "snapshots"),
      );
      return [
        m("Net worth", formatMoney(s.netWorth, { currency }), "line-chart", undefined, s.netWorth >= 0 ? "positive" : "negative"),
        m("Assets", formatMoney(s.assets, { currency }), "bank"),
        m("Liabilities", formatMoney(s.liabilities, { currency }), "receipt", undefined, "negative"),
        m("Unrealized gain", formatMoney(s.unrealizedGain, { currency, signed: true }), "trendingUp", formatPercent(s.unrealizedGainPct), s.unrealizedGain >= 0 ? "positive" : "negative"),
      ];
    }
    case "bookkeeping": {
      const s = bookkeepingSummary(rows<BusinessTransaction>(data, "transactions"), currentMonth());
      return [
        m("Cash revenue", formatMoney(s.cashRevenue, { currency }), "arrowUp"),
        m("Operating expenses", formatMoney(s.operatingExpenses, { currency }), "arrowDown", undefined, "negative"),
        m("Operating surplus", formatMoney(s.operatingSurplus, { currency, signed: true }), "wallet", undefined, s.operatingSurplus >= 0 ? "positive" : "negative"),
        m("Expense ratio", formatPercent(s.expenseRatio), "percent"),
      ];
    }
    case "inventory": {
      const s = inventorySummary(rows<BusinessProduct>(data, "products"), rows<InventoryMovement>(data, "movements"));
      return [
        m("Inventory value", formatMoney(s.inventoryValue, { currency }), "package", "Weighted average cost"),
        m("Retail value", formatMoney(s.retailValue, { currency }), "tag"),
        m("Units on hand", String(s.totalUnits), "boxes"),
        m("Low stock", String(s.lowStock.length), "alert", `${s.productCount} products`, s.lowStock.length ? "warning" : "neutral"),
      ];
    }
    case "sales": {
      const s = salesSummary(rows<Sale>(data, "sales"), rows<SalesTarget>(data, "targets"), { period: currentMonth() });
      return [
        m("Net sales", formatMoney(s.net, { currency }), "shopping-cart", `${s.orders} orders`),
        m("Average order", s.averageOrderValue ? formatMoney(s.averageOrderValue, { currency }) : "—", "receipt"),
        m("Target progress", formatPercent(s.targetProgress), "target", s.target ? `of ${formatMoney(s.target, { currency })}` : "No target"),
        m("Collected", formatMoney(s.collectedRevenue, { currency }), "dollar", undefined, "positive"),
      ];
    }
    case "invoicing": {
      const s = invoicingSummary(rows<Invoice>(data, "invoices"), rows<Payment>(data, "payments"));
      return [
        m("Outstanding", formatMoney(s.outstanding, { currency }), "file-text", `${s.rows.length} invoices`),
        m("Overdue", formatMoney(s.overdueAmount, { currency }), "alert", `${s.overdue.length} invoices`, s.overdueAmount > 0 ? "negative" : "neutral"),
        m("Payments received", formatMoney(s.paidThisPeriod, { currency }), "dollar", undefined, "positive"),
        m("Drafts", String(s.draftCount), "edit"),
      ];
    }
    case "cash-flow": {
      const scenario = rows<CashScenario>(data, "scenarios")[0];
      if (!scenario) return [m("Opening cash", "Not set", "waves", "Set a scenario to project")];
      const f = forecastCashFlow(rows<CashForecastItem>(data, "items"), scenario, { weeks: 13 });
      return [
        m("Closing cash (13w)", formatMoney(f.closingCash, { currency }), "waves", undefined, f.closingCash >= 0 ? "positive" : "negative"),
        m("Net forecast flow", formatMoney(f.netFlow, { currency, signed: true }), "swap"),
        m("Lowest cash", formatMoney(f.lowestCash, { currency }), "gauge", undefined, f.lowestCash < scenario.minimumCash ? "warning" : "neutral"),
        m("Shortfall", formatMoney(f.shortfall, { currency }), "alert", undefined, f.shortfall > 0 ? "negative" : "neutral"),
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
        m("Days to go", String(s.daysUntil), "clock", wedding?.eventDate ?? "Set the date"),
        m("Budget remaining", formatMoney(s.budgetRemaining, { currency }), "wallet", `${formatMoney(s.committed, { currency })} committed`, s.overBudget ? "negative" : "neutral"),
        m("Guests accepted", `${s.guestSeatsAccepted}`, "users", `${formatPercent(s.acceptanceRate)} of invited`),
        m("Vendor balance", formatMoney(s.vendorOutstanding, { currency }), "briefcase"),
      ];
    }
    case "property": {
      const bookings = rows<PropertyBooking>(data, "bookings");
      const s = propertySummary({
        bookings,
        expenses: rows<PropertyExpense>(data, "expenses"),
        maintenance: rows<PropertyMaintenance>(data, "maintenance"),
        availableNights: 365,
      });
      return [
        m("Accommodation revenue", formatMoney(s.accommodationRevenue, { currency }), "home"),
        m("Net operating income", formatMoney(s.netOperatingIncome, { currency }), "wallet", undefined, s.netOperatingIncome >= 0 ? "positive" : "negative"),
        m("Occupancy", formatPercent(s.occupancyRate), "gauge", `${s.occupiedNights} nights`),
        m("ADR", s.adr ? formatMoney(s.adr, { currency }) : "—", "tag", s.revPan ? `RevPAN ${formatMoney(s.revPan, { currency })}` : undefined),
      ];
    }
    case "nutrition": {
      const totals = dailyTotals(rows<NutritionLog>(data, "logs"), todayISO());
      return [
        m("Calories today", String(Math.round(totals.kcal)), "utensils", `${totals.entries} entries`),
        m("Protein", `${totals.protein} g`, "zap"),
        m("Carbs", `${totals.carbs} g`, "coffee"),
        m("Fat", `${totals.fat} g`, "droplet"),
      ];
    }
    case "projects": {
      const s = projectProgress(rows<Task>(data, "tasks"));
      return [
        m("Completion", formatPercent(s.completionPct), "kanban", `${s.completed}/${s.total} tasks`),
        m("Overdue", String(s.overdue), "alert", undefined, s.overdue ? "negative" : "neutral"),
      ];
    }
    case "habits": {
      const s = habitsOverview(rows<Habit>(data, "habits"), rows<HabitCompletion>(data, "completions"));
      return [
        m("Done today", `${s.doneToday}/${s.scheduledToday}`, "circle-check", "Scheduled habits only"),
        m("Today's rate", formatPercent(s.todayRate), "gauge"),
        m("Best streak", `${s.bestStreak}`, "zap", "scheduled days"),
        m("Active habits", String(s.habits.length), "repeat"),
      ];
    }
    case "content": {
      const s = contentSummary(rows<ContentPost>(data, "posts"), currentMonth());
      return [
        m("Publishing rate", formatPercent(s.publishingRate), "gauge"),
        m("Engagement", formatPercent(s.engagementRate), "trendingUp", s.totalReach ? `${s.totalReach} reach` : "Manual metrics"),
      ];
    }
    default:
      return [];
  }
}

export { EmptyState, Button };
