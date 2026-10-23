/**
 * Shared, pure reporting selectors for the Annual Budget tool.
 *
 * Every chart on the budget screen is a *visualisation of trusted application data*, never an
 * independent source of truth. These helpers translate a single `budgetSummary()` result into the
 * exact shapes the chart components expect, so the bars, donut, budget-vs-actual and trend charts
 * always agree with the KPI cards and underlying transactions. Keeping the transformation here (and
 * out of the components) satisfies the data-integrity requirement and makes the logic unit-testable.
 */

import type { BudgetSummary, CategorySpend } from "@/lib/calc/money";
import type { MoneyBudget, MoneyCategory, MoneyTransaction } from "@/lib/types";
import type { MonthlyPointInput } from "@/components/charts/monthly-comparison-chart";
import type { CategorySlice } from "@/components/charts/category-breakdown-chart";
import type { BudgetActualRow } from "@/components/charts/budget-vs-actual-chart";

/** Chart A — grouped income vs expenses across all months of the period. */
export function monthlyComparisonData(summary: BudgetSummary): MonthlyPointInput[] {
  return summary.monthly.map((m) => ({ month: m.month, income: m.income, expenses: m.expenses }));
}

/**
 * Chart B — expense breakdown donut. Very small categories are merged into "Other" so the
 * donut stays legible. `maxSlices` caps the number of arcs; everything beyond that becomes Other.
 */
export function categorySlices(
  byCategory: CategorySpend[],
  opts: { maxSlices?: number; otherLabel?: string } = {},
): CategorySlice[] {
  const maxSlices = opts.maxSlices ?? 7;
  const otherLabel = opts.otherLabel ?? "Other";

  const expenses = byCategory
    .filter((c) => c.kind === "expense" && c.actual > 0)
    .sort((a, b) => b.actual - a.actual);

  if (!expenses.length) return [];

  if (expenses.length <= maxSlices) {
    return expenses.map((c) => ({ id: c.categoryId, name: c.name, value: c.actual }));
  }

  const head = expenses.slice(0, maxSlices - 1).map((c) => ({
    id: c.categoryId,
    name: c.name,
    value: c.actual,
  }));
  const rest = expenses.slice(maxSlices - 1);
  const otherValue = rest.reduce((sum, c) => sum + c.actual, 0);

  return [...head, { id: "__other__", name: otherLabel, value: otherValue }];
}

/** Chart C — budget allocation vs actual spend per category. Overspend is highlighted by the chart. */
export function budgetActualRows(byCategory: CategorySpend[]): BudgetActualRow[] {
  return byCategory
    .filter((c) => c.kind === "expense" && (c.budget > 0 || c.actual > 0))
    .sort((a, b) => b.budget + b.actual - (a.budget + a.actual))
    .map((c) => ({ category: c.name, budget: c.budget, actual: c.actual }));
}

/** Chart D — net cash flow (and its income/expense components) over time. */
export interface CashFlowTrendPoint {
  month: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function cashFlowTrend(summary: BudgetSummary): CashFlowTrendPoint[] {
  return summary.monthly.map((m) => ({
    month: m.month,
    label: MONTH_LABELS[Number(m.month.slice(5, 7)) - 1] ?? m.month,
    income: m.income,
    expenses: m.expenses,
    net: m.net,
  }));
}

/** Highest-spending categories for the annual insights ranking. */
export function topExpenseCategories(byCategory: CategorySpend[], max = 8) {
  return byCategory
    .filter((c) => c.kind === "expense" && c.actual > 0)
    .sort((a, b) => b.actual - a.actual)
    .slice(0, max)
    .map((c) => ({ id: c.categoryId, label: c.name, value: c.actual }));
}

/** Budget utilisation per category for the progress view (actual / allocation). */
export interface BudgetUtilisation {
  id: string;
  label: string;
  value: number;
  target: number;
  over: boolean;
}

export function budgetUtilisation(byCategory: CategorySpend[]): BudgetUtilisation[] {
  return byCategory
    .filter((c) => c.kind === "expense" && c.budget > 0)
    .sort((a, b) => b.budget - a.budget)
    .map((c) => ({
      id: c.categoryId,
      label: c.name,
      value: c.actual,
      target: c.budget,
      over: c.actual > c.budget,
    }));
}

/**
 * Chart C — annual budget (allocation) vs actual spend per category, for a whole year.
 *
 * `budgetSummary(period: "YYYY")` intentionally does NOT aggregate the per-month budget rows (its
 * `byCategory[].budget` only reflects the *single* active budget month), so we compute the annual
 * figure here: budget = sum of every monthly budget row in `year`, actual = sum of posted expenses
 * in `year`. Both numbers come from the same authoritative collections the rest of the app reads, so
 * the bars always agree with the KPIs and the underlying transactions.
 */
export function annualBudgetVsActual(input: {
  transactions: MoneyTransaction[];
  categories: MoneyCategory[];
  budgets: MoneyBudget[];
  year: string;
  currency?: string;
}): BudgetActualRow[] {
  const catMap = new Map(input.categories.map((c) => [c.id, c]));
  const actual = new Map<string, number>();
  const budget = new Map<string, number>();

  for (const t of input.transactions) {
    if (t.deleted || t.status !== "posted" || !t.date.startsWith(input.year)) continue;
    if (t.type !== "expense") continue;
    const key = t.categoryId || "uncategorized";
    actual.set(key, (actual.get(key) ?? 0) + t.amount);
  }
  for (const b of input.budgets) {
    if (b.deleted || !b.month.startsWith(input.year)) continue;
    budget.set(b.categoryId, (budget.get(b.categoryId) ?? 0) + b.amount);
  }

  const ids = new Set<string>([...actual.keys(), ...budget.keys()]);
  const rows: BudgetActualRow[] = [];
  for (const id of ids) {
    const a = Math.round((actual.get(id) ?? 0) * 100) / 100;
    const b = Math.round((budget.get(id) ?? 0) * 100) / 100;
    if (a === 0 && b === 0) continue;
    const cat = catMap.get(id);
    rows.push({ category: cat?.name ?? "Uncategorized", budget: b, actual: a });
  }
  return rows.sort((x, y) => y.budget + y.actual - (x.budget + x.actual));
}

/** Total annual budget allocation (sum of every monthly budget row in the year). */
export function annualBudgetAllocation(budgets: MoneyBudget[], year: string): number {
  return Math.round(
    budgets
      .filter((b) => !b.deleted && b.month.startsWith(year))
      .reduce((sum, b) => sum + b.amount, 0) * 100,
  ) / 100;
}

/** CSV export of the current report — respects the selected period, no fabricated rows. */
export function budgetReportCSV(
  summary: BudgetSummary,
  opts: { periodLabel: string; currency: string },
): string {
  const lines: string[] = [];
  lines.push(`Gridhub budget report,${opts.periodLabel},${opts.currency}`);
  lines.push("");
  lines.push("Monthly,Income,Expenses,Net");
  for (const m of summary.monthly) {
    lines.push(`${m.month},${m.income},${m.expenses},${m.net}`);
  }
  lines.push("");
  lines.push("Category,Kind,Actual,Budget,Variance");
  for (const c of summary.byCategory) {
    lines.push(`${c.name},${c.kind},${c.actual},${c.budget},${c.variance}`);
  }
  return lines.join("\n");
}
