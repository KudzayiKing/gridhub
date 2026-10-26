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
import { formatMoney, round2 } from "@/lib/money";
import { accountBalance, budgetSummary, currentMonth, currentYear, savingsTotals, goalSummary, debtTotals, simulateDebt } from "@/lib/calc/money";
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
import type { MoneyTransaction, MoneyCategory, MoneyBudget, SavingsGoal, GoalMovement, NutritionLog, Task, BusinessProduct, InventoryMovement, Debt, DebtPayment, BusinessTransaction, Paycheck, PaycheckAllocation, PaySchedule, MoneyAccount, RecurringBill } from "@/lib/types";
import { monthlyComparisonData, categorySlices, budgetActualRows, cashFlowTrend } from "@/lib/reporting/budget";
import { paycheckAllocationBreakdown, monthlyBillOccurrences, nextPaydayDate } from "@/lib/reporting/paycheck";
import { BudgetVsActualChart } from "@/components/charts/budget-vs-actual-chart";
import { debtDueOccurrences, estimatedDebtProgress, localISODate } from "@/lib/reporting/debt-tracker";
import { savingsBalanceTrend, savingsGoalRows } from "@/lib/reporting/savings-dashboard";

function dateAfterDays(date: string, days: number) {
  const next = new Date(date + "T00:00:00");
  next.setDate(next.getDate() + days);
  return localISODate(next);
}

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
  const eligibleGoals = goals.rows.filter((goal) => !goal.deleted && (!goal.currency || goal.currency === currency));
  const totals = savingsTotals(eligibleGoals, movements.rows.filter((movement) => eligibleGoals.some((goal) => goal.id === movement.goalId)));
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

function SavingsBalanceWidget({ currency }: { currency: string }) {
  const goals = useCollection<SavingsGoal>("savings", "goals");
  const movements = useCollection<GoalMovement>("savings", "movements");
  const today = localISODate(new Date());
  const eligibleGoals = goals.rows.filter((goal) => !goal.deleted && (!goal.currency || goal.currency === currency));
  const history = savingsBalanceTrend(eligibleGoals, movements.rows, 12, today);
  return history.length ? <TrendChart data={history} xKey="month" series={[{ key: "balance", name: "Savings balance" }]} formatValue={fmtFactory(currency)} type="area" height={190} /> : <p className="py-6 text-center text-[11px] text-fg-subtle">No dated savings activity</p>;
}

function SavingsEmergencyWidget({ currency }: { currency: string }) {
  const goals = useCollection<SavingsGoal>("savings", "goals");
  const movements = useCollection<GoalMovement>("savings", "movements");
  const eligibleGoals = goals.rows.filter((goal) => !goal.deleted && (!goal.currency || goal.currency === currency));
  const emergency = savingsGoalRows(eligibleGoals, movements.rows, localISODate(new Date())).find((row) => row.goal.kind === "emergency");
  const coverage = emergency?.goal.monthlyEssentials ? emergency.balance / emergency.goal.monthlyEssentials : null;
  return <p className="py-5 text-center text-xl font-semibold">{coverage == null ? "Set essential expenses" : `${coverage.toFixed(1)} months`}{coverage != null ? <span className="block text-[10px] font-normal text-fg-subtle">{formatMoney(emergency!.balance, { currency })} emergency savings</span> : null}</p>;
}

function SavingsMilestoneWidget({ currency }: { currency: string }) {
  const goals = useCollection<SavingsGoal>("savings", "goals");
  const movements = useCollection<GoalMovement>("savings", "movements");
  const today = localISODate(new Date());
  const eligibleGoals = goals.rows.filter((goal) => !goal.deleted && (!goal.currency || goal.currency === currency));
  const next = savingsGoalRows(eligibleGoals, movements.rows, today).filter((row) => row.goal.targetDate && row.remaining > 0 && row.goal.targetDate >= today).sort((a, b) => (a.goal.targetDate ?? "").localeCompare(b.goal.targetDate ?? ""))[0];
  return next ? <div className="py-4 text-center"><p className="text-sm font-semibold">{next.goal.name}</p><p className="text-[11px] text-fg-subtle">{next.goal.targetDate} · {formatMoney(next.remaining, { currency })} remaining</p></div> : <p className="py-6 text-center text-[11px] text-fg-subtle">No upcoming target</p>;
}

function SavingsMonthlyNeedWidget({ currency }: { currency: string }) {
  const goals = useCollection<SavingsGoal>("savings", "goals");
  const movements = useCollection<GoalMovement>("savings", "movements");
  const eligibleGoals = goals.rows.filter((goal) => !goal.deleted && (!goal.currency || goal.currency === currency));
  const summaries = savingsGoalRows(eligibleGoals, movements.rows, localISODate(new Date()));
  const requirements = summaries.filter((row) => row.requiredMonthly != null && row.remaining > 0);
  const total = requirements.reduce((sum, row) => sum + (row.requiredMonthly ?? 0), 0);
  return <p className="py-5 text-center text-xl font-semibold">{requirements.length ? formatMoney(total, { currency }) : "Set target dates"}<span className="block text-[10px] font-normal text-fg-subtle">Combined monthly requirement</span></p>;
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

function DebtTotalWidget({ currency }: { currency: string }) {
  const debts = useCollection<Debt>("debt", "debts");
  return <p className="py-5 text-center text-2xl font-semibold tnum">{formatMoney(debtTotals(debts.rows.filter((debt) => !debt.deleted)).balance, { currency })}</p>;
}

function DebtFreeWidget({ currency }: { currency: string }) {
  const debts = useCollection<Debt>("debt", "debts");
  const { prefs } = usePrefs();
  const strategy = prefs.periods?.["debt-strategy"] === "avalanche" ? "avalanche" : "snowball";
  const input = debts.rows.filter((debt) => !debt.deleted && debt.openingPrincipal > 0).map((debt) => ({ id: debt.id, name: debt.name, balance: debt.openingPrincipal, annualRate: debt.annualRate, minimumPayment: debt.minimumPayment * (debt.frequency === "biweekly" ? 26 / 12 : 1) }));
  const extra = debts.rows.filter((debt) => !debt.deleted).reduce((sum, debt) => sum + Math.max(0, debt.extraPayment ?? 0), 0);
  const simulation = simulateDebt(input, extra, strategy);
  return <div className="py-4 text-center"><p className="text-xl font-semibold">{!input.length ? "No debts" : simulation.nonAmortizing ? "Payment too low" : simulation.payoffDate.slice(0, 7)}</p><p className="text-[11px] text-fg-subtle">{input.length && !simulation.nonAmortizing ? `${simulation.months} months · ${strategy}` : "Estimated payoff"}</p><p className="mt-1 text-[11px]">{formatMoney(simulation.totalInterest, { currency })} projected interest</p></div>;
}

function DebtProjectionWidget({ currency }: { currency: string }) {
  const debts = useCollection<Debt>("debt", "debts");
  const { prefs } = usePrefs();
  const strategy = prefs.periods?.["debt-strategy"] === "avalanche" ? "avalanche" : "snowball";
  const input = debts.rows.filter((debt) => !debt.deleted && debt.openingPrincipal > 0).map((debt) => ({ id: debt.id, name: debt.name, balance: debt.openingPrincipal, annualRate: debt.annualRate, minimumPayment: debt.minimumPayment * (debt.frequency === "biweekly" ? 26 / 12 : 1) }));
  const extra = debts.rows.filter((debt) => !debt.deleted).reduce((sum, debt) => sum + Math.max(0, debt.extraPayment ?? 0), 0);
  const simulation = simulateDebt(input, extra, strategy);
  return simulation.nonAmortizing ? <p className="py-6 text-center text-[11px] text-fg-subtle">Payment does not amortise this balance</p> : <TrendChart data={[{ label: "Now", balance: input.reduce((sum, debt) => sum + debt.balance, 0) }, ...simulation.monthlyBalances.map((point) => ({ label: `M${point.month}`, balance: point.total }))]} xKey="label" series={[{ key: "balance", name: "Projected debt" }]} formatValue={fmtFactory(currency)} type="line" height={190} />;
}

function DebtProgressWidget({ currency }: { currency: string }) {
  const debts = useCollection<Debt>("debt", "debts");
  const payments = useCollection<DebtPayment>("debt", "payments");
  const progress = debts.rows.filter((debt) => !debt.deleted).map((debt) => estimatedDebtProgress(debt, payments.rows));
  const paid = progress.reduce((sum, row) => sum + row.principalPaid, 0);
  const original = progress.reduce((sum, row) => sum + row.estimatedOriginal, 0);
  return <ProgressChart items={[{ id: "debt-progress", label: "Principal repaid · estimate", value: paid, target: original, formatValue: fmtFactory(currency) }]} />;
}

function DebtNextPaymentWidget({ currency }: { currency: string }) {
  const debts = useCollection<Debt>("debt", "debts");
  const payments = useCollection<DebtPayment>("debt", "payments");
  const today = localISODate(new Date());
  const events = debtDueOccurrences(debts.rows.filter((debt) => !debt.deleted), payments.rows, today, dateAfterDays(today, 31), today)
    .filter((event) => event.status !== "paid" && event.status !== "skipped").sort((a, b) => a.date.localeCompare(b.date));
  const next = events[0];
  return next ? <div className="py-4 text-center"><p className="text-xl font-semibold">{formatMoney(next.amount, { currency })}</p><p className="text-[11px] text-fg-subtle">{next.debtName} · {next.date}</p><p className="text-[10px] capitalize">{next.status}</p></div> : <p className="py-6 text-center text-[11px] text-fg-subtle">No known upcoming date</p>;
}

function DebtUpcomingWidget({ currency }: { currency: string }) {
  const debts = useCollection<Debt>("debt", "debts");
  const payments = useCollection<DebtPayment>("debt", "payments");
  const today = localISODate(new Date());
  const events = debtDueOccurrences(debts.rows.filter((debt) => !debt.deleted), payments.rows, today, dateAfterDays(today, 31), today)
    .filter((event) => event.status !== "paid" && event.status !== "skipped").slice(0, 5);
  return events.length ? <div className="flex flex-col gap-2 py-1">{events.map((event) => <div key={event.id} className="flex justify-between gap-2 text-[11px]"><span className="truncate">{event.debtName} · {event.date}</span><span className="tnum">{formatMoney(event.amount, { currency })}</span></div>)}</div> : <p className="py-6 text-center text-[11px] text-fg-subtle">No known upcoming dates</p>;
}

function PaycheckNextWidget({ currency }: { currency: string }) {
  const schedules = useCollection<PaySchedule>("paycheck", "schedules");
  const checks = useCollection<Paycheck>("paycheck", "paychecks");
  const now = new Date();
  const today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  const schedulePay = schedules.rows.filter((s) => !s.deleted && (!s.currency || s.currency === currency)).map((s) => ({ date: nextPaydayDate(s.frequency, s.nextPayDate, today), amount: s.expectedAmount, name: s.name })).filter((item): item is { date: string; amount: number; name: string } => Boolean(item.date)).sort((a, b) => a.date.localeCompare(b.date))[0];
  const recorded = checks.rows.filter((p) => !p.deleted && p.date >= today && (!p.scheduleId || !schedules.rows.some((s) => s.id === p.scheduleId) || schedules.rows.find((s) => s.id === p.scheduleId)?.currency === currency)).sort((a, b) => a.date.localeCompare(b.date))[0];
  const next = schedulePay && (!recorded || schedulePay.date <= recorded.date) ? schedulePay : recorded ? { date: recorded.date, amount: recorded.expectedAmount, name: "Recorded paycheck" } : null;
  if (!next) return <p className="py-6 text-center text-[12px] text-fg-subtle">Add a pay schedule with its next payday</p>;
  return <div className="py-4 text-center"><p className="tnum text-2xl font-semibold">{formatMoney(next.amount, { currency })}</p><p className="mt-1 text-[12px] text-fg-muted">Expected {next.date} · {next.name}</p></div>;
}

function PaycheckAvailableWidget({ currency }: { currency: string }) {
  const schedules = useCollection<PaySchedule>("paycheck", "schedules");
  const checks = useCollection<Paycheck>("paycheck", "paychecks");
  const accounts = useCollection<MoneyAccount>("budget", "accounts");
  const transactions = useCollection<MoneyTransaction>("budget", "transactions");
  const bills = useCollection<RecurringBill>("budget", "bills");
  const allocations = useCollection<PaycheckAllocation>("paycheck", "allocations");
  const now = new Date();
  const today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  const payday = schedules.rows.filter((s) => !s.deleted && (!s.currency || s.currency === currency)).map((s) => nextPaydayDate(s.frequency, s.nextPayDate, today)).filter((date): date is string => Boolean(date)).sort()[0]
    ?? checks.rows.filter((p) => !p.deleted && p.date >= today && (!p.scheduleId || !schedules.rows.some((s) => s.id === p.scheduleId) || schedules.rows.find((s) => s.id === p.scheduleId)?.currency === currency)).map((p) => p.date).sort()[0];
  const cashAccounts = accounts.rows.filter((account) => (account.kind === "checking" || account.kind === "cash") && account.currency === currency);
  if (!cashAccounts.length) return <p className="py-6 text-center text-[12px] text-fg-subtle">Add a checking or cash account balance</p>;
  const balance = cashAccounts.reduce((sum, account) => sum + accountBalance(account.openingBalance, transactions.rows, account.id), 0);
  const start = new Date(today + "T00:00:00");
  const end = payday ? new Date(payday + "T00:00:00") : new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const endDate = end.getFullYear() + "-" + String(end.getMonth() + 1).padStart(2, "0") + "-" + String(end.getDate()).padStart(2, "0");
  const pendingBills = monthlyBillOccurrences(bills.rows, today, endDate, checks.rows, allocations.rows).filter((bill) => !bill.paid && !transactions.rows.some((tx) => !tx.deleted && tx.status === "posted" && tx.type === "expense" && tx.date === bill.dueDate && tx.description.trim().toLocaleLowerCase() === bill.name.trim().toLocaleLowerCase()));
  const remaining = round2(balance - pendingBills.reduce((sum, bill) => sum + bill.amount, 0));
  return <div className="py-4 text-center"><p className={"tnum text-2xl font-semibold " + (remaining < 0 ? "text-[var(--negative)]" : "text-fg")}>{formatMoney(remaining, { currency })}</p><p className="mt-1 text-[12px] text-fg-muted">Checking/cash balance less known bills before payday · estimate</p></div>;
}

function PaycheckAllocationWidget({ currency }: { currency: string }) {
  const checks = useCollection<Paycheck>("paycheck", "paychecks");
  const allocations = useCollection<PaycheckAllocation>("paycheck", "allocations");
  const debtPayments = useCollection<DebtPayment>("debt", "payments");
  const schedules = useCollection<PaySchedule>("paycheck", "schedules");
  const check = checks.rows.filter((p) => p.date.startsWith(currentMonth()) && (!p.scheduleId || !schedules.rows.some((s) => s.id === p.scheduleId) || schedules.rows.find((s) => s.id === p.scheduleId)?.currency === currency)).sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!check) return <p className="py-6 text-center text-[12px] text-fg-subtle">No paycheck recorded this month</p>;
  const breakdown = paycheckAllocationBreakdown(check, allocations.rows, debtPayments.rows);
  return <CategoryBreakdownChart data={breakdown.slices} formatValue={fmtFactory(currency)} centerLabel={check.actualAmount == null ? "Expected" : "Received"} centerValue={formatMoney(breakdown.amount, { currency })} height={220} />;
}

function PaycheckBudgetWidget({ currency }: { currency: string }) {
  const tx = useCollection<MoneyTransaction>("budget", "transactions");
  const cats = useCollection<MoneyCategory>("budget", "categories");
  const budgets = useCollection<MoneyBudget>("budget", "budgets");
  const summary = budgetSummary({ transactions: tx.rows.filter((row) => !row.currency || row.currency === currency), categories: cats.rows, budgets: budgets.rows, period: currentMonth(), currency });
  return <BudgetVsActualChart data={budgetActualRows(summary.byCategory)} formatValue={fmtFactory(currency)} />;
}

function PaycheckMonthlyWidget({ currency }: { currency: string }) {
  const tx = useCollection<MoneyTransaction>("budget", "transactions");
  const cats = useCollection<MoneyCategory>("budget", "categories");
  const summary = budgetSummary({ transactions: tx.rows.filter((row) => !row.currency || row.currency === currency), categories: cats.rows, budgets: [], period: currentYear(), currency });
  return <MonthlyComparisonChart data={monthlyComparisonData(summary)} formatValue={fmtFactory(currency)} height={220} />;
}

function PaycheckBillsWidget({ currency }: { currency: string }) {
  const bills = useCollection<RecurringBill>("budget", "bills");
  const checks = useCollection<Paycheck>("paycheck", "paychecks");
  const allocations = useCollection<PaycheckAllocation>("paycheck", "allocations");
  const start = currentMonth() + "-01";
  const endDate = new Date(start + "T00:00:00");
  endDate.setMonth(endDate.getMonth() + 1);
  const end = endDate.getFullYear() + "-" + String(endDate.getMonth() + 1).padStart(2, "0") + "-01";
  const scheduled = monthlyBillOccurrences(bills.rows, start, end, checks.rows, allocations.rows).filter((bill) => !bill.paid);
  if (!scheduled.length) return <p className="py-6 text-center text-[12px] text-fg-subtle">No monthly bills marked as due</p>;
  return <div className="flex flex-col gap-2">{scheduled.slice(0, 6).map((bill) => <div key={bill.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-2 text-[11px]"><span className="truncate">{bill.name} · {bill.dueDate}</span><span className="tnum shrink-0">{formatMoney(bill.amount, { currency })}</span></div>)}</div>;
}

function PaycheckForecastWidget({ currency }: { currency: string }) {
  const schedules = useCollection<PaySchedule>("paycheck", "schedules");
  const checks = useCollection<Paycheck>("paycheck", "paychecks");
  const accounts = useCollection<MoneyAccount>("budget", "accounts");
  const transactions = useCollection<MoneyTransaction>("budget", "transactions");
  const bills = useCollection<RecurringBill>("budget", "bills");
  const allocations = useCollection<PaycheckAllocation>("paycheck", "allocations");
  const now = new Date();
  const today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  const scheduleDate = schedules.rows.filter((s) => !s.currency || s.currency === currency).map((s) => nextPaydayDate(s.frequency, s.nextPayDate, today)).filter((date): date is string => Boolean(date)).sort()[0];
  const recordedDate = checks.rows.filter((p) => p.date >= today).map((p) => p.date).sort()[0];
  const payday = scheduleDate ?? recordedDate;
  const cashAccounts = accounts.rows.filter((account) => (account.kind === "checking" || account.kind === "cash") && account.currency === currency);
  if (!payday || !cashAccounts.length || payday <= today) return <p className="py-6 text-center text-[12px] text-fg-subtle">Add a checking/cash balance and an upcoming payday to forecast</p>;
  const days = Math.ceil((new Date(payday + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
  if (days > 90) return <p className="py-6 text-center text-[12px] text-fg-subtle">Next payday is more than 90 days away</p>;
  const opening = cashAccounts.reduce((sum, account) => sum + accountBalance(account.openingBalance, transactions.rows, account.id), 0);
  const billsToPay = monthlyBillOccurrences(bills.rows, today, payday, checks.rows, allocations.rows).filter((bill) => !bill.paid);
  const deductions = new Map<string, number>();
  for (const bill of billsToPay) deductions.set(bill.dueDate, (deductions.get(bill.dueDate) ?? 0) + bill.amount);
  let balance = opening;
  const points = [{ label: "Today", balance }];
  for (let offset = 1; offset < days; offset++) {
    const day = new Date(today + "T00:00:00");
    day.setDate(day.getDate() + offset);
    const date = day.getFullYear() + "-" + String(day.getMonth() + 1).padStart(2, "0") + "-" + String(day.getDate()).padStart(2, "0");
    balance -= deductions.get(date) ?? 0;
    points.push({ label: date.slice(5), balance });
  }
  return <><p className="mb-2 text-[10px] text-fg-subtle">Account balance less scheduled monthly bills · excludes unlinked planned expenses</p><TrendChart data={points} xKey="label" series={[{ key: "balance", name: "Estimated cash" }]} formatValue={fmtFactory(currency)} height={190} type="line" /></>;
}

export const CHART_WIDGETS: ChartWidgetDef[] = [
  { id: "budget.monthly", tool: "budget", title: "Monthly income vs expenses", description: "Annual Budget · all 12 months", Component: BudgetMonthlyWidget },
  { id: "budget.categories", tool: "budget", title: "Spending by category", description: "Annual Budget · expense breakdown", Component: BudgetCategoriesWidget },
  { id: "savings.goals", tool: "savings", title: "Savings goal progress", description: "Savings · contributions vs targets", Component: SavingsGoalsWidget },
  { id: "savings.balance-trend", tool: "savings", title: "Savings Balance Trend", description: "Savings · last 12 months of dated activity", Component: SavingsBalanceWidget },
  { id: "savings.emergency-coverage", tool: "savings", title: "Emergency Fund Coverage", description: "Savings · verified essential expense baseline", Component: SavingsEmergencyWidget },
  { id: "savings.next-milestone", tool: "savings", title: "Next Savings Milestone", description: "Savings · upcoming goal target", Component: SavingsMilestoneWidget },
  { id: "savings.monthly-needed", tool: "savings", title: "Monthly Contribution Requirement", description: "Savings · combined current monthly target", Component: SavingsMonthlyNeedWidget },
  { id: "nutrition.weekly", tool: "nutrition", title: "Weekly calories", description: "Nutrition · last 7 days", Component: NutritionWeeklyWidget },
  { id: "projects.completion", tool: "projects", title: "Task completion", description: "Projects · overall progress", Component: ProjectsCompletionWidget },
  { id: "inventory.lowstock", tool: "inventory", title: "Low-stock products", description: "Inventory · items needing reorder", Component: InventoryLowStockWidget },
  { id: "bookkeeping.revenue", tool: "bookkeeping", title: "Revenue trend", description: "Bookkeeping · monthly revenue", Component: BookkeepingRevenueWidget },
  { id: "debt.payoff", tool: "debt", title: "Debt balances", description: "Debt · balance by account", Component: DebtPayoffWidget },
  { id: "debt.total", tool: "debt", title: "Total Debt Remaining", description: "Debt · current tracked balances", Component: DebtTotalWidget },
  { id: "debt.next-payment", tool: "debt", title: "Next Debt Payment", description: "Debt · next dated payment", Component: DebtNextPaymentWidget },
  { id: "debt.payoff-date", tool: "debt", title: "Estimated Debt-Free Date", description: "Debt · current strategy projection", Component: DebtFreeWidget },
  { id: "debt.projection", tool: "debt", title: "Debt Balance Projection", description: "Debt · monthly projected balances", Component: DebtProjectionWidget },
  { id: "debt.progress", tool: "debt", title: "Debt-Free Progress", description: "Debt · principal repaid estimate", Component: DebtProgressWidget },
  { id: "debt.upcoming", tool: "debt", title: "Upcoming Debt Payments", description: "Debt · next 31 days", Component: DebtUpcomingWidget },
  { id: "paycheck.next-paycheck", tool: "paycheck", title: "Next Paycheck", description: "Paycheck Planner · next expected payday and amount", Component: PaycheckNextWidget },
  { id: "paycheck.available-spend", tool: "paycheck", title: "Available to Spend", description: "Paycheck Planner · checking/cash less known bills", Component: PaycheckAvailableWidget },
  { id: "paycheck.allocation", tool: "paycheck", title: "Paycheck allocation", description: "Paycheck Planner · recorded allocation breakdown", Component: PaycheckAllocationWidget },
  { id: "paycheck.budget-actual", tool: "paycheck", title: "Budget vs actual", description: "Paycheck Planner · monthly category budget comparison", Component: PaycheckBudgetWidget },
  { id: "paycheck.payday-forecast", tool: "paycheck", title: "Money left until payday", description: "Paycheck Planner · estimated cash and known monthly bills", Component: PaycheckForecastWidget },
  { id: "paycheck.bills", tool: "paycheck", title: "Bills still due", description: "Paycheck Planner · monthly bill templates not marked paid", Component: PaycheckBillsWidget },
  { id: "paycheck.monthly-trend", tool: "paycheck", title: "Monthly income vs expenses", description: "Paycheck Planner · posted income and expenses", Component: PaycheckMonthlyWidget },
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
