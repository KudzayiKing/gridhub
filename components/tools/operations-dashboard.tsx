"use client";

import * as React from "react";
import { CategoryBreakdownChart, ChartContainer, ChartEmptyState, TrendChart } from "@/components/charts";
import { CompactMetric } from "@/components/ui/card";
import { PinChartButton } from "@/lib/chart-widgets";
import { formatMoney, round2 } from "@/lib/money";
import { rows, type DataMap } from "@/lib/tools/shared";
import { bookkeepingSummary, inventorySummary, salesSummary, invoicingSummary, forecastCashFlow } from "@/lib/calc/business";
import { dailyTotals } from "@/lib/calc/life";
import { contentSummary } from "@/lib/calc/work";
import type { BusinessProduct, BusinessTransaction, CashForecastItem, CashScenario, ContentPost, Habit, HabitCompletion, InventoryMovement, Invoice, MoneyCategory, NutritionLog, Payment, PropertyExpense, Sale, SalesTarget, Task, WeddingExpense } from "@/lib/types";
import type { ToolId } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n";

export interface DashboardKpi {
  label: string;
  value: string;
  icon?: string;
  hint?: string;
  tone?: "neutral" | "positive" | "negative" | "warning";
}

/** Shared desktop composition: signature visualization on the left, one compact KPI card on the right. */
export function OperationsDashboard({
  title,
  description,
  kpis,
  hero,
  children,
  pin,
}: {
  title: string;
  description: string;
  kpis: DashboardKpi[];
  hero: React.ReactNode;
  children?: React.ReactNode;
  pin?: { chartId: string; title: string; tool: ToolId };
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-[16px] font-semibold">{t(title)}</h2><p className="text-[11px] text-fg-muted">{t(description)}</p></div>
      </div>
      <div className="grid items-stretch gap-3 lg:grid-cols-2">
        <ChartContainer title="Signature visualization" subtitle="A current breakdown or projection from saved records" icon="chart-column" action={pin ? <PinChartButton {...pin} /> : undefined}>{hero}</ChartContainer>
        <ChartContainer title="Key performance indicators" subtitle="Calculated from this tool’s saved records" icon="gauge">
          <div className="grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3">{kpis.slice(0, 6).map((item) => <CompactMetric key={item.label} label={item.label} value={item.value} hint={item.hint} tone={item.tone === "warning" ? "negative" : item.tone ?? "neutral"} />)}</div>
        </ChartContainer>
      </div>
      {children ? <div className="grid gap-3 lg:grid-cols-2">{children}</div> : null}
    </div>
  );
}

const colors = ["var(--positive)", "var(--accent)", "var(--warning)", "var(--negative)", "#76a8c9", "#b39ddb"];
const all = <T extends { deleted?: boolean }>(rows_: T[]) => rows_.filter((row) => !row.deleted);
const today = () => new Date().toISOString().slice(0, 10);
const asSlices = (entries: Array<{ id: string; name: string; value: number }>) => entries.filter((row) => row.value > 0).map((row, index) => ({ ...row, color: colors[index % colors.length] }));
const sum = (values: number[]) => round2(values.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0));

/** Signature visualization for non-Money tools, sourced from their existing domain records. */
export function OperationsHero({ toolId, data, currency }: { toolId: ToolId; data: DataMap; currency: string }) {
  const { t } = useI18n();
  const fmt = (value: number | string | undefined) => formatMoney(Number(value ?? 0), { currency });
  let name = "Record breakdown";
  let value = 0;
  let chart: React.ReactNode = null;
  if (toolId === "bookkeeping") {
    name = "Expenses by category";
    const categories = rows<MoneyCategory>(data, "categories");
    const tx = all(rows<BusinessTransaction>(data, "transactions"));
    const summary = bookkeepingSummary(tx); value = summary.operatingExpenses;
    const byCategory = new Map<string, number>();
    for (const row of tx.filter((item) => item.type === "expense")) { const label = categories.find((category) => category.id === row.categoryId)?.name ?? "Uncategorized"; byCategory.set(label, (byCategory.get(label) ?? 0) + row.amount); }
    chart = <CategoryBreakdownChart data={asSlices([...byCategory].map(([label, amount]) => ({ id: label, name: label, value: amount })))} formatValue={fmt} centerLabel="Cash expenses" centerValue={fmt(value)} height={290} />;
  } else if (toolId === "inventory") {
    name = "Inventory value by category";
    const summary = inventorySummary(rows<BusinessProduct>(data, "products"), rows<InventoryMovement>(data, "movements")); value = summary.inventoryValue;
    const byCategory = new Map<string, number>(); for (const row of summary.items) { const label = row.product.category || "Uncategorized"; byCategory.set(label, (byCategory.get(label) ?? 0) + row.valuation.inventoryValue); }
    chart = <CategoryBreakdownChart data={asSlices([...byCategory].map(([label, amount]) => ({ id: label, name: label, value: amount })))} formatValue={fmt} centerLabel="At weighted cost" centerValue={fmt(value)} height={290} />;
  } else if (toolId === "sales") {
    name = "Sales by product or service";
    const summary = salesSummary(all(rows<Sale>(data, "sales")).filter((row) => (row.currency || "USD") === currency), all(rows<SalesTarget>(data, "targets")).filter((row) => (row.currency || "USD") === currency)); value = summary.net;
    chart = <CategoryBreakdownChart data={asSlices(summary.byProduct.map((row) => ({ id: row.productId, name: row.label, value: row.net })))} formatValue={fmt} centerLabel="Net sales" centerValue={fmt(value)} height={290} />;
  } else if (toolId === "invoicing") {
    name = "Invoice status";
    const summary = invoicingSummary(rows<Invoice>(data, "invoices").filter((row) => !row.deleted && (row.currency || "USD") === currency), rows<Payment>(data, "payments"), today());
    const issued = summary.rows.filter((row) => row.invoice.status !== "draft" && row.invoice.status !== "void"); value = sum(issued.map((row) => row.totals.total));
    const status = [
      { id: "paid", name: "Paid", value: sum(issued.filter((row) => row.totals.balanceDue <= 0).map((row) => row.totals.total)) },
      { id: "partial", name: "Partially paid", value: sum(issued.filter((row) => row.totals.paid > 0 && row.totals.balanceDue > 0 && !row.totals.isOverdue).map((row) => row.totals.balanceDue)) },
      { id: "overdue", name: "Overdue", value: sum(issued.filter((row) => row.totals.isOverdue).map((row) => row.totals.balanceDue)) },
      { id: "unpaid", name: "Unpaid", value: sum(issued.filter((row) => row.totals.paid <= 0 && row.totals.balanceDue > 0 && !row.totals.isOverdue).map((row) => row.totals.balanceDue)) },
    ];
    chart = <CategoryBreakdownChart data={asSlices(status)} formatValue={fmt} centerLabel="Total invoiced" centerValue={fmt(value)} height={290} />;
  } else if (toolId === "cash-flow") {
    name = "Projected cash balance";
    const scenario = rows<CashScenario>(data, "scenarios").find((row) => !row.deleted);
    if (scenario) {
      const forecast = forecastCashFlow(rows<CashForecastItem>(data, "items"), scenario, { weeks: 13 }); value = forecast.closingCash;
      chart = <TrendChart data={forecast.weeks.map((row) => ({ week: new Date(row.label + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }), closing: row.closing }))} xKey="week" series={[{ key: "closing", name: "Projected closing cash" }]} formatValue={fmt} height={290} />;
    } else chart = <ChartEmptyState label="Add a cash scenario to see projected balances." />;
  } else if (toolId === "wedding") {
    name = "Wedding budget allocation";
    const expenses = all(rows<WeddingExpense>(data, "expenses")); value = sum(expenses.map((row) => row.committed));
    const byCategory = new Map<string, number>(); for (const row of expenses) byCategory.set(row.category || "Uncategorized", (byCategory.get(row.category || "Uncategorized") ?? 0) + row.committed);
    chart = <CategoryBreakdownChart data={asSlices([...byCategory].map(([label, amount]) => ({ id: label, name: label, value: amount })))} formatValue={fmt} centerLabel="Committed" centerValue={fmt(value)} height={290} />;
  } else if (toolId === "property") {
    name = "Rental expenses by category";
    const propertyIds = new Set(rows<import("@/lib/types").Property>(data, "properties").filter((row) => !row.deleted && (row.currency || "USD") === currency).map((row) => row.id));
    const expenses = all(rows<PropertyExpense>(data, "expenses")).filter((row) => propertyIds.has(row.propertyId)); value = sum(expenses.map((row) => row.amount));
    const byCategory = new Map<string, number>(); for (const row of expenses) byCategory.set(row.category || "Uncategorized", (byCategory.get(row.category || "Uncategorized") ?? 0) + row.amount);
    chart = <CategoryBreakdownChart data={asSlices([...byCategory].map(([label, amount]) => ({ id: label, name: label, value: amount })))} formatValue={fmt} centerLabel="Recorded expenses" centerValue={fmt(value)} height={290} />;
  } else if (toolId === "nutrition") {
    name = "Today’s macro balance";
    const totals = dailyTotals(rows<NutritionLog>(data, "logs"), today());
    const items = [{ id: "protein", name: "Protein", value: totals.protein * 4 }, { id: "carbs", name: "Carbohydrates", value: totals.carbs * 4 }, { id: "fat", name: "Fat", value: totals.fat * 9 }];
    value = totals.kcal; chart = <CategoryBreakdownChart data={asSlices(items)} formatValue={(amount) => Math.round(Number(amount ?? 0)) + " kcal"} centerLabel="Logged calories" centerValue={Math.round(value) + " kcal"} height={290} />;
  } else if (toolId === "projects") {
    name = "Task status";
    const tasks = all(rows<Task>(data, "tasks")); value = tasks.length;
    const items = [{ id: "todo", name: "To do", value: tasks.filter((row) => row.status === "todo").length }, { id: "progress", name: "In progress", value: tasks.filter((row) => row.status === "in_progress").length }, { id: "review", name: "In review", value: tasks.filter((row) => row.status === "review").length }, { id: "done", name: "Completed", value: tasks.filter((row) => row.status === "done").length }];
    chart = <CategoryBreakdownChart data={asSlices(items)} formatValue={(amount) => Number(amount ?? 0) + " tasks"} centerLabel="Tasks" centerValue={String(value)} height={290} />;
  } else if (toolId === "habits") {
    name = "Today’s scheduled check-ins";
    const habits = all(rows<Habit>(data, "habits")).filter((row) => !row.archived); const completions = all(rows<HabitCompletion>(data, "completions")); const date = today();
    const scheduled = habits.filter((row) => row.frequency === "daily" || row.days.includes(new Date(date + "T00:00:00").getDay())).length;
    const completed = Math.min(scheduled, new Set(completions.filter((row) => row.date === date).map((row) => row.habitId)).size); value = completed;
    chart = <CategoryBreakdownChart data={asSlices([{ id: "done", name: "Done", value: completed }, { id: "remaining", name: "Remaining today", value: Math.max(0, scheduled - completed) }])} formatValue={(amount) => Number(amount ?? 0) + " check-ins"} centerLabel="Completed" centerValue={completed + " / " + scheduled} height={290} />;
  } else if (toolId === "content") {
    name = "Content status";
    const posts = all(rows<ContentPost>(data, "posts")); const summary = contentSummary(posts); value = posts.length;
    const items = ["idea", "draft", "scheduled", "published"].map((status) => ({ id: status, name: status[0].toUpperCase() + status.slice(1), value: posts.filter((row) => row.status === status).length }));
    chart = <CategoryBreakdownChart data={asSlices(items)} formatValue={(amount) => Number(amount ?? 0) + " posts"} centerLabel="Publishing rate" centerValue={summary.publishingRate == null ? "—" : Math.round(summary.publishingRate) + "%"} height={290} />;
  }
  return <div><p className="mb-1 text-[11px] font-medium text-fg-muted">{t(name)}</p>{chart ?? <ChartEmptyState label="No records available yet." />}</div>;
}
