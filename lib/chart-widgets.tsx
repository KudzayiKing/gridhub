"use client";

/**
 * Unified dashboard chart pinning.
 *
 * Users can pin a chart from any activated tool to the home dashboard. Pins are stored in
 * `UserPreferences.pinnedCharts` (per-device, reconciled with the server like every other preference),
 * so they persist across sessions. Pinning never duplicates a record or query — each widget renders
 * straight from the existing offline-first collections via the same calculation engines the tools use.
 *
 * The pure reducers at the top are unit-tested and contain no React, so the persistence logic can be
 * verified without a DOM. The widget registry below declares the renderable charts and the tool each
 * one belongs to, which is what gates visibility by entitlement.
 */

import * as React from "react";
import { useCollection } from "@/lib/store";
import { usePrefs, useSyncState } from "@/components/providers";
import { useActiveTools } from "@/lib/use-tools";
import { TOOL_MAP } from "@/lib/catalog";
import type { ToolId } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { budgetSummary, currentYear, savingsTotals, goalSummary, debtTotals } from "@/lib/calc/money";
import { dailyTotals } from "@/lib/calc/life";
import { projectProgress } from "@/lib/calc/work";
import { inventorySummary } from "@/lib/calc/business";
import { rows } from "@/lib/tools/shared";
import { ChartContainer } from "@/components/charts/chart-container";
import { MonthlyComparisonChart } from "@/components/charts/monthly-comparison-chart";
import { CategoryBreakdownChart } from "@/components/charts/category-breakdown-chart";
import { ProgressChart } from "@/components/charts/progress-chart";
import { HorizontalRankingChart } from "@/components/charts/horizontal-ranking-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { AreaTrend } from "@/components/charts/trend";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { ToolIcon } from "@/components/icons/tool-icons";
import type { MoneyTransaction, MoneyCategory, MoneyBudget, SavingsGoal, GoalMovement, NutritionLog, Task, BusinessProduct, InventoryMovement, Debt, BusinessTransaction } from "@/lib/types";
import { monthlyComparisonData, categorySlices, budgetActualRows, cashFlowTrend } from "@/lib/reporting/budget";

/* ==========================================================================
   Pure pin-state reducers (unit tested)
   ========================================================================== */

export interface PinnedChart {
  id: string;
  tool: ToolId;
  chart: string;
  title: string;
}

export function isPinned(pins: PinnedChart[], chartId: string): boolean {
  return pins.some((p) => p.id === chartId);
}

export function addPin(pins: PinnedChart[], pin: PinnedChart): PinnedChart[] {
  if (isPinned(pins, pin.id)) return pins;
  return [...pins, pin];
}

export function removePin(pins: PinnedChart[], id: string): PinnedChart[] {
  return pins.filter((p) => p.id !== id);
}

export function movePin(pins: PinnedChart[], id: string, dir: -1 | 1): PinnedChart[] {
  const idx = pins.findIndex((p) => p.id === id);
  if (idx === -1) return pins;
  const target = idx + dir;
  if (target < 0 || target >= pins.length) return pins;
  const next = [...pins];
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

/* ==========================================================================
   Widget registry
   ========================================================================== */

export interface ChartWidgetDef {
  id: string;
  tool: ToolId;
  title: string;
  description: string;
  Component: React.ComponentType<{ currency: string }>;
}

function fmtFactory(currency: string) {
  return (v: number | string | undefined) => formatMoney(Number(v ?? 0), { currency, maximumFractionDigits: 0 });
}

function BudgetMonthlyWidget({ currency }: { currency: string }) {
  const tx = useCollection<MoneyTransaction>("budget", "transactions");
  const cats = useCollection<MoneyCategory>("budget", "categories");
  const budgets = useCollection<MoneyBudget>("budget", "budgets");
  const s = budgetSummary({ transactions: tx.rows, categories: cats.rows, budgets: budgets.rows, period: currentYear(), currency });
  return (
    <MonthlyComparisonChart
      data={monthlyComparisonData(s)}
      formatValue={(v) => formatMoney(v ?? 0, { currency, maximumFractionDigits: 0 })}
      height={220}
    />
  );
}

function BudgetCategoriesWidget({ currency }: { currency: string }) {
  const tx = useCollection<MoneyTransaction>("budget", "transactions");
  const cats = useCollection<MoneyCategory>("budget", "categories");
  const budgets = useCollection<MoneyBudget>("budget", "budgets");
  const s = budgetSummary({ transactions: tx.rows, categories: cats.rows, budgets: budgets.rows, period: currentYear(), currency });
  const slices = categorySlices(s.byCategory);
  return (
    <CategoryBreakdownChart
      data={slices}
      formatValue={(v) => formatMoney(Number(v ?? 0), { currency, maximumFractionDigits: 0 })}
      centerLabel="Spent"
      centerValue={formatMoney(s.expenses, { currency, maximumFractionDigits: 0 })}
      height={220}
    />
  );
}

function SavingsGoalsWidget({ currency }: { currency: string }) {
  const goals = useCollection<SavingsGoal>("savings", "goals");
  const movements = useCollection<GoalMovement>("savings", "movements");
  const totals = savingsTotals(goals.rows, movements.rows);
  if (!totals.goals.length) return <p className="py-6 text-center text-[12px] text-fg-subtle">No goals yet</p>;
  return (
    <ProgressChart
      items={totals.goals.map((g) => ({
        id: g.id,
        label: g.name,
        value: g.balance,
        target: g.target,
        formatValue: (v) => formatMoney(v, { currency, maximumFractionDigits: 0 }),
        caption: g.remaining <= 0 ? "Target reached" : `${formatMoney(g.remaining, { currency, maximumFractionDigits: 0 })} to go`,
      }))}
    />
  );
}

function NutritionWeeklyWidget({ currency }: { currency: string }) {
  const logs = useCollection<NutritionLog>("nutrition", "logs");
  const days = React.useMemo(() => {
    const out: { label: string; value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      out.push({ label: d.toLocaleDateString(undefined, { weekday: "narrow" }), value: Math.round(dailyTotals(logs.rows, iso).kcal) });
    }
    return out;
  }, [logs.rows]);
  return <AreaTrend data={days} format={(n) => `${Math.round(n)} kcal`} ariaLabel="Daily calories last 7 days" height={180} />;
}

function ProjectsCompletionWidget({ currency }: { currency: string }) {
  const tasks = useCollection<Task>("projects", "tasks");
  const s = projectProgress(tasks.rows);
  if (!s.total) return <p className="py-6 text-center text-[12px] text-fg-subtle">No tasks yet</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full border-2 border-[var(--accent)] text-[15px] font-semibold tnum">
          {Math.round(s.completionPct ?? 0)}%
        </div>
        <div>
          <p className="text-[13px] font-medium">{s.completed} of {s.total} tasks done</p>
          <p className="text-[11.5px] text-fg-subtle">{s.remaining} remaining · {s.overdue} overdue</p>
        </div>
      </div>
    </div>
  );
}

function InventoryLowStockWidget({ currency }: { currency: string }) {
  const products = useCollection<BusinessProduct>("inventory", "products");
  const movements = useCollection<InventoryMovement>("inventory", "movements");
  const s = inventorySummary(products.rows, movements.rows);
  if (!s.lowStock.length) return <p className="py-6 text-center text-[12px] text-fg-subtle">Nothing low — all stock healthy</p>;
  return (
    <HorizontalRankingChart
      data={s.lowStock.map((p) => ({ id: p.product.id, label: p.product.name, value: p.valuation.quantity }))}
      formatValue={(v) => `${Math.round(Number(v ?? 0))} left`}
      height={Math.max(160, s.lowStock.length * 34 + 24)}
    />
  );
}

function BookkeepingRevenueWidget({ currency }: { currency: string }) {
  const tx = useCollection<BusinessTransaction>("bookkeeping", "transactions");
  const year = currentYear();
  const monthly = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tx.rows) {
      if (t.deleted || t.type !== "revenue") continue;
      if (!t.date.startsWith(year)) continue;
      map.set(t.date.slice(0, 7), (map.get(t.date.slice(0, 7)) ?? 0) + t.amount);
    }
    const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return Array.from({ length: 12 }, (_, i) => {
      const m = `${year}-${String(i + 1).padStart(2, "0")}`;
      return { month: m, label: labels[i], revenue: map.get(m) ?? 0 };
    });
  }, [tx.rows, year]);
  return (
    <TrendChart
      data={monthly}
      xKey="label"
      series={[{ key: "revenue", name: "Revenue" }]}
      formatValue={(v) => formatMoney(Number(v ?? 0), { currency, maximumFractionDigits: 0 })}
      height={200}
      type="area"
    />
  );
}

function DebtPayoffWidget({ currency }: { currency: string }) {
  const debts = useCollection<Debt>("debt", "debts");
  const totals = debtTotals(debts.rows);
  if (!totals.count) return <p className="py-6 text-center text-[12px] text-fg-subtle">No debts tracked</p>;
  return (
    <HorizontalRankingChart
      data={debts.rows.map((d) => ({ id: d.id, label: d.name, value: d.openingPrincipal }))}
      formatValue={(v) => formatMoney(Number(v ?? 0), { currency, maximumFractionDigits: 0 })}
      height={Math.max(160, debts.rows.length * 34 + 24)}
    />
  );
}

export const CHART_WIDGETS: ChartWidgetDef[] = [
  { id: "budget.monthly", tool: "budget", title: "Monthly income vs expenses", description: "Annual Budget · all 12 months", Component: BudgetMonthlyWidget },
  { id: "budget.categories", tool: "budget", title: "Spending by category", description: "Annual Budget · expense breakdown", Component: BudgetCategoriesWidget },
  { id: "savings.goals", tool: "savings", title: "Savings goal progress", description: "Savings · contributions vs targets", Component: SavingsGoalsWidget },
  { id: "nutrition.weekly", tool: "nutrition", title: "Weekly calories", description: "Nutrition · last 7 days", Component: NutritionWeeklyWidget },
  { id: "projects.completion", tool: "projects", title: "Task completion", description: "Projects · overall progress", Component: ProjectsCompletionWidget },
  { id: "inventory.lowstock", tool: "inventory", title: "Low-stock products", description: "Inventory · items needing reorder", Component: InventoryLowStockWidget },
  { id: "bookkeeping.revenue", tool: "bookkeeping", title: "Revenue trend", description: "Bookkeeping · monthly revenue", Component: BookkeepingRevenueWidget },
  { id: "debt.payoff", tool: "debt", title: "Debt balances", description: "Debt · balance by account", Component: DebtPayoffWidget },
];

export function getWidget(id: string): ChartWidgetDef | undefined {
  return CHART_WIDGETS.find((w) => w.id === id);
}

/* ==========================================================================
   React: pin button + pinned widget card + dashboard section
   ========================================================================== */

export function PinChartButton({ chartId, title, tool }: { chartId: string; title: string; tool: ToolId }) {
  const { prefs, setPrefs } = usePrefs();
  const pins = (prefs.pinnedCharts ?? []) as PinnedChart[];
  const pinned = isPinned(pins, chartId);

  const toggle = async () => {
    const next = pinned
      ? removePin(pins, chartId)
      : addPin(pins, { id: chartId, tool, chart: chartId, title });
    await setPrefs({ pinnedCharts: next });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={pinned}
      aria-label={pinned ? `Unpin ${title}` : `Pin ${title} to dashboard`}
      title={pinned ? "Pinned to dashboard" : "Pin to dashboard"}
      className="press grid h-7 w-7 place-items-center rounded-lg border border-line text-fg-muted transition-colors hover:bg-[var(--surface-strong)] hover:text-fg"
    >
      <AnimatedIcon name={pinned ? "pin" : "pinOff"} size={14} trigger="click" />
    </button>
  );
}

function OfflineBadge() {
  const sync = useSyncState();
  if (sync.pending > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-[var(--bg-subtle)] px-2 py-0.5 text-[10.5px] text-fg-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
        {sync.pending} pending sync
      </span>
    );
  }
  if (sync.phase === "local") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-[var(--bg-subtle)] px-2 py-0.5 text-[10.5px] text-fg-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--fg-subtle)]" />
        Offline
      </span>
    );
  }
  return null;
}

export function ChartWidgetCard({ pin }: { pin: PinnedChart }) {
  const def = getWidget(pin.id);
  const { prefs, setPrefs } = usePrefs();
  const { active } = useActiveTools();
  const pins = (prefs.pinnedCharts ?? []) as PinnedChart[];

  if (!def) return null;
  const toolActive = active.includes(def.tool);

  if (!toolActive) {
    return (
      <ChartContainer title={def.title} subtitle={def.description} icon="lock">
        <p className="py-6 text-center text-[12px] text-fg-subtle">
          This chart belongs to a tool you haven&apos;t activated.
        </p>
      </ChartContainer>
    );
  }

  const Widget = def.Component;
  const currency = prefs.currency || "USD";

  return (
    <ChartContainer
      title={def.title}
      subtitle={def.description}
      icon={TOOL_MAP[def.tool]?.icon}
      action={
        <div className="flex items-center gap-1.5">
          <OfflineBadge />
          <button
            type="button"
            aria-label="Move widget up"
            onClick={() => setPrefs({ pinnedCharts: movePin(pins, pin.id, -1) })}
            className="press grid h-7 w-7 place-items-center rounded-lg border border-line text-fg-muted hover:bg-[var(--surface-strong)] hover:text-fg"
          >
            <AnimatedIcon name="chevronUp" size={13} trigger="click" />
          </button>
          <button
            type="button"
            aria-label="Move widget down"
            onClick={() => setPrefs({ pinnedCharts: movePin(pins, pin.id, 1) })}
            className="press grid h-7 w-7 place-items-center rounded-lg border border-line text-fg-muted hover:bg-[var(--surface-strong)] hover:text-fg"
          >
            <AnimatedIcon name="chevronDown" size={13} trigger="click" />
          </button>
          <button
            type="button"
            aria-label={`Remove ${def.title}`}
            onClick={() => setPrefs({ pinnedCharts: removePin(pins, pin.id) })}
            className="press grid h-7 w-7 place-items-center rounded-lg border border-line text-fg-muted hover:bg-[var(--surface-strong)] hover:text-fg"
          >
            <AnimatedIcon name="close" size={13} trigger="click" />
          </button>
        </div>
      }
    >
      <Widget currency={currency} />
    </ChartContainer>
  );
}

export function AddChartMenu() {
  const { prefs, setPrefs } = usePrefs();
  const { active } = useActiveTools();
  const pins = (prefs.pinnedCharts ?? []) as PinnedChart[];
  const available = CHART_WIDGETS.filter((w) => active.includes(w.tool) && !isPinned(pins, w.id));

  if (!available.length) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {available.map((w) => (
        <button
          key={w.id}
          type="button"
          onClick={() => setPrefs({ pinnedCharts: addPin(pins, { id: w.id, tool: w.tool, chart: w.id, title: w.title }) })}
          className="press inline-flex items-center gap-1.5 rounded-full border border-line bg-[var(--surface-strong)] px-3 py-1.5 text-[12px] font-medium text-fg-muted transition-colors hover:bg-[var(--accent)] hover:text-[var(--accent-fg)]"
        >
          <ToolIcon toolId={w.tool} size={13} trigger="none" />
          {w.title}
          <AnimatedIcon name="plus" size={12} trigger="click" />
        </button>
      ))}
    </div>
  );
}

export function PinnedCharts() {
  const { prefs } = usePrefs();
  const pins = (prefs.pinnedCharts ?? []) as PinnedChart[];
  if (!pins.length) return null;
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2">
        {pins.map((pin) => (
          <ChartWidgetCard key={pin.id} pin={pin} />
        ))}
      </div>
    </>
  );
}
