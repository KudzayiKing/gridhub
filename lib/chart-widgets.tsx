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
import { LazyMotion, domAnimation, m } from "motion/react";
import { useCollection } from "@/lib/store";
import { usePrefs, useSyncState } from "@/components/providers";
import { useActiveTools } from "@/lib/use-tools";
import { TOOL_MAP } from "@/lib/catalog";
import type { ToolId } from "@/lib/catalog";
import { formatMoney, round2 } from "@/lib/money";
import { accountBalance, budgetSummary, currentMonth, currentYear, savingsTotals, debtTotals, simulateDebt } from "@/lib/calc/money";
import { dailyTotals } from "@/lib/calc/life";
import { projectProgress } from "@/lib/calc/work";
import { inventorySummary, salesSummary, invoicingSummary, forecastCashFlow } from "@/lib/calc/business";
import { habitsOverview, contentSummary } from "@/lib/calc/work";
import { ChartContainer } from "@/components/charts/chart-container";
import { MonthlyComparisonChart } from "@/components/charts/monthly-comparison-chart";
import { CategoryBreakdownChart } from "@/components/charts/category-breakdown-chart";
import { ProgressChart } from "@/components/charts/progress-chart";
import { HorizontalRankingChart } from "@/components/charts/horizontal-ranking-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { AreaTrend } from "@/components/charts/trend";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { ToolIcon } from "@/components/icons/tool-icons";
import type { MoneyTransaction, MoneyCategory, MoneyBudget, SavingsGoal, GoalMovement, NutritionLog, Task, BusinessProduct, InventoryMovement, Debt, DebtPayment, BusinessTransaction, Paycheck, PaycheckAllocation, PaySchedule, MoneyAccount, RecurringBill, NetWorthItem, Holding, ValuationSnapshot, Sale, SalesTarget, Invoice, Payment, CashForecastItem, CashScenario, WeddingExpense, Property, PropertyBooking, PropertyExpense, Habit, HabitCompletion, ContentPost } from "@/lib/types";
import { monthlyComparisonData, categorySlices, budgetActualRows } from "@/lib/reporting/budget";
import { paycheckAllocationBreakdown, monthlyBillOccurrences, nextPaydayDate } from "@/lib/reporting/paycheck";
import { BudgetVsActualChart } from "@/components/charts/budget-vs-actual-chart";
import { debtDueOccurrences, estimatedDebtProgress, localISODate } from "@/lib/reporting/debt-tracker";
import { savingsBalanceTrend, savingsGoalRows } from "@/lib/reporting/savings-dashboard";
import { netWorthSummary } from "@/lib/calc/money";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

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

function NutritionWeeklyWidget() {
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

function ProjectsCompletionWidget() {
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

function InventoryLowStockWidget() {
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

function NetWorthAllocationWidget({ currency }: { currency: string }) {
  const itemStore = useCollection<NetWorthItem>("net-worth", "items");
  const holdingStore = useCollection<Holding>("net-worth", "holdings");
  const allItems = itemStore.rows.filter((row) => !row.deleted && (row.currency || "USD") === currency);
  const items = allItems.filter((row) => row.kind === "asset" && row.value > 0);
  const assetIds = new Set(allItems.filter((row) => row.kind === "asset").map((row) => row.id));
  const holdings = holdingStore.rows.filter((row) => !row.deleted && (row.currency || "USD") === currency);
  const totals = new Map<string, number>();
  items.forEach((row) => {
    const label = row.category?.trim() || "Uncategorized";
    totals.set(label, (totals.get(label) ?? 0) + row.value);
  });
  holdings.filter((row) => !row.parentAssetId || !assetIds.has(row.parentAssetId)).forEach((row) => {
    const label = "Investment · " + (row.assetClass?.trim() || "Unclassified");
    totals.set(label, (totals.get(label) ?? 0) + row.quantity * row.unitPrice);
  });
  const data = [...totals].map(([name, value]) => ({ id: name, name, value }));
  const total = data.reduce((sum, row) => sum + row.value, 0);
  return <CategoryBreakdownChart data={data} formatValue={(value) => formatMoney(Number(value ?? 0), { currency })} centerLabel="Total assets" centerValue={formatMoney(total, { currency })} height={210} />;
}

function NetWorthGrowthWidget({ currency }: { currency: string }) {
  const itemStore = useCollection<NetWorthItem>("net-worth", "items");
  const holdingStore = useCollection<Holding>("net-worth", "holdings");
  const snapshotStore = useCollection<ValuationSnapshot>("net-worth", "snapshots");
  const snapshots = snapshotStore.rows.filter((row) => !row.deleted && (row.currency || "USD") === currency).sort((a, b) => a.date.localeCompare(b.date));
  const summary = netWorthSummary(itemStore.rows, holdingStore.rows, snapshots, currency);
  const values = summary.history.map((row) => ({ date: row.date, netWorth: row.netWorth }));
  return values.length > 1
    ? <TrendChart data={values} xKey="date" series={[{ key: "netWorth", name: "Net worth" }]} formatValue={fmtFactory(currency)} type="line" height={210} />
    : <p className="py-6 text-center text-[12px] text-fg-subtle">Record another dated valuation to see net-worth growth</p>;
}

function SalesRevenueWidget({ currency }: { currency: string }) {
  const sales = useCollection<Sale>("sales", "sales");
  const targets = useCollection<SalesTarget>("sales", "targets");
  const summary = salesSummary(sales.rows.filter((row) => !row.deleted && (row.currency || "USD") === currency), targets.rows.filter((row) => !row.deleted && (row.currency || "USD") === currency));
  return summary.byMonth.length
    ? <TrendChart data={summary.byMonth.map((row) => ({ month: row.month, net: row.net }))} xKey="month" series={[{ key: "net", name: "Net sales" }]} formatValue={fmtFactory(currency)} height={210} />
    : <p className="py-6 text-center text-[11px] text-fg-subtle">No sale records yet</p>;
}

function InvoiceCollectionsWidget({ currency }: { currency: string }) {
  const invoices = useCollection<Invoice>("invoicing", "invoices");
  const payments = useCollection<Payment>("invoicing", "payments");
  const eligible = invoices.rows.filter((row) => !row.deleted && (row.currency || "USD") === currency);
  const invoiceIds = new Set(eligible.map((row) => row.id));
  const summary = invoicingSummary(eligible, payments.rows.filter((row) => invoiceIds.has(row.invoiceId)), localISODate(new Date()));
  const balances = [
    { id: "current", name: "Current", value: summary.rows.filter((row) => row.totals.balanceDue > 0 && !row.totals.isOverdue).reduce((sum, row) => sum + row.totals.balanceDue, 0) },
    { id: "overdue", name: "Overdue", value: summary.overdueAmount },
  ];
  return <CategoryBreakdownChart data={balances} formatValue={fmtFactory(currency)} centerLabel="Outstanding" centerValue={formatMoney(summary.outstanding, { currency })} height={210} />;
}

function CashForecastWidget({ currency }: { currency: string }) {
  const scenarios = useCollection<CashScenario>("cash-flow", "scenarios");
  const items = useCollection<CashForecastItem>("cash-flow", "items");
  const scenario = scenarios.rows.find((row) => !row.deleted);
  if (!scenario) return <p className="py-6 text-center text-[11px] text-fg-subtle">Create a forecast scenario</p>;
  const forecast = forecastCashFlow(items.rows, scenario, { weeks: 13 });
  return <TrendChart data={forecast.weeks.map((row) => ({ week: row.label, closing: row.closing }))} xKey="week" series={[{ key: "closing", name: "Projected cash" }]} formatValue={fmtFactory(currency)} height={210} type="line" />;
}

function WeddingBudgetWidget({ currency }: { currency: string }) {
  const expenses = useCollection<WeddingExpense>("wedding", "expenses");
  const data = expenses.rows.filter((row) => !row.deleted).reduce((list, row) => {
    const name = row.category || "Uncategorized";
    const existing = list.find((entry) => entry.id === name);
    if (existing) existing.value += row.committed;
    else list.push({ id: name, name, value: row.committed });
    return list;
  }, [] as { id: string; name: string; value: number }[]);
  const committed = data.reduce((sum, row) => sum + row.value, 0);
  return <CategoryBreakdownChart data={data} formatValue={fmtFactory(currency)} centerLabel="Committed" centerValue={formatMoney(committed, { currency })} height={210} />;
}

function PropertyRevenueWidget({ currency }: { currency: string }) {
  const properties = useCollection<Property>("property", "properties");
  const bookings = useCollection<PropertyBooking>("property", "bookings");
  const eligible = new Set(properties.rows.filter((row) => !row.deleted && (row.currency || "USD") === currency).map((row) => row.id));
  const grouped = new Map<string, number>();
  for (const booking of bookings.rows.filter((row) => !row.deleted && row.status !== "cancelled" && eligible.has(row.propertyId))) {
    const month = booking.checkIn.slice(0, 7); grouped.set(month, (grouped.get(month) ?? 0) + booking.accommodation);
  }
  const data = [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([month, revenue]) => ({ month, revenue }));
  return data.length ? <TrendChart data={data} xKey="month" series={[{ key: "revenue", name: "Accommodation revenue" }]} formatValue={fmtFactory(currency)} height={210} /> : <p className="py-6 text-center text-[11px] text-fg-subtle">No non-cancelled bookings yet</p>;
}

function HabitTodayWidget() {
  const habits = useCollection<Habit>("habits", "habits");
  const completions = useCollection<HabitCompletion>("habits", "completions");
  const summary = habitsOverview(habits.rows, completions.rows, localISODate(new Date()));
  return <p className="py-6 text-center text-xl font-semibold">{summary.doneToday} / {summary.scheduledToday}<span className="block text-[11px] font-normal text-fg-subtle">scheduled habits done today</span></p>;
}

function ContentPipelineWidget() {
  const posts = useCollection<ContentPost>("content", "posts");
  const summary = contentSummary(posts.rows);
  const status = ["idea", "draft", "scheduled", "published"].map((name) => ({ id: name, name: name[0].toUpperCase() + name.slice(1), value: posts.rows.filter((row) => !row.deleted && row.status === name).length }));
  return <CategoryBreakdownChart data={status} formatValue={(value) => Number(value ?? 0) + " posts"} centerLabel="Publishing rate" centerValue={summary.publishingRate == null ? "N/A" : Math.round(summary.publishingRate) + "%"} height={210} />;
}

function BookkeepingExpensesWidget({ currency }: { currency: string }) {
  const transactions = useCollection<BusinessTransaction>("bookkeeping", "transactions");
  const categories = useCollection<MoneyCategory>("bookkeeping", "categories");
  const totals = new Map<string, number>();
  for (const row of transactions.rows.filter((item) => !item.deleted && item.type === "expense")) {
    const name = categories.rows.find((category) => category.id === row.categoryId)?.name ?? "Uncategorized";
    totals.set(name, (totals.get(name) ?? 0) + row.amount);
  }
  const data = [...totals].map(([name, value]) => ({ id: name, name, value }));
  return <CategoryBreakdownChart data={data} formatValue={fmtFactory(currency)} centerLabel="Cash expenses" centerValue={formatMoney(data.reduce((sum, row) => sum + row.value, 0), { currency })} height={210} />;
}

function InventoryValueWidget({ currency }: { currency: string }) {
  const products = useCollection<BusinessProduct>("inventory", "products");
  const movements = useCollection<InventoryMovement>("inventory", "movements");
  const summary = inventorySummary(products.rows, movements.rows);
  const totals = new Map<string, number>();
  for (const row of summary.items) { const name = row.product.category || "Uncategorized"; totals.set(name, (totals.get(name) ?? 0) + row.valuation.inventoryValue); }
  const data = [...totals].map(([name, value]) => ({ id: name, name, value }));
  return <CategoryBreakdownChart data={data} formatValue={fmtFactory(currency)} centerLabel="At weighted cost" centerValue={formatMoney(summary.inventoryValue, { currency })} height={210} />;
}

function SalesProductsWidget({ currency }: { currency: string }) {
  const sales = useCollection<Sale>("sales", "sales");
  const targets = useCollection<SalesTarget>("sales", "targets");
  const summary = salesSummary(sales.rows.filter((row) => !row.deleted && (row.currency || "USD") === currency), targets.rows.filter((row) => !row.deleted && (row.currency || "USD") === currency));
  return <CategoryBreakdownChart data={summary.byProduct.map((row) => ({ id: row.productId, name: row.label, value: row.net }))} formatValue={fmtFactory(currency)} centerLabel="Net sales" centerValue={formatMoney(summary.net, { currency })} height={210} />;
}

function PropertyExpenseWidget({ currency }: { currency: string }) {
  const properties = useCollection<Property>("property", "properties");
  const expenses = useCollection<PropertyExpense>("property", "expenses");
  const propertyIds = new Set(properties.rows.filter((row) => !row.deleted && (row.currency || "USD") === currency).map((row) => row.id));
  const totals = new Map<string, number>();
  for (const row of expenses.rows.filter((item) => !item.deleted && propertyIds.has(item.propertyId))) totals.set(row.category || "Uncategorized", (totals.get(row.category || "Uncategorized") ?? 0) + row.amount);
  const data = [...totals].map(([name, value]) => ({ id: name, name, value }));
  return <CategoryBreakdownChart data={data} formatValue={fmtFactory(currency)} centerLabel="Expenses" centerValue={formatMoney(data.reduce((sum, row) => sum + row.value, 0), { currency })} height={210} />;
}

function NutritionMacrosWidget() {
  const logs = useCollection<NutritionLog>("nutrition", "logs");
  const totals = dailyTotals(logs.rows, localISODate(new Date()));
  const data = [{ id: "protein", name: "Protein", value: totals.protein * 4 }, { id: "carbs", name: "Carbohydrates", value: totals.carbs * 4 }, { id: "fat", name: "Fat", value: totals.fat * 9 }];
  return <CategoryBreakdownChart data={data} formatValue={(value) => Math.round(Number(value ?? 0)) + " kcal"} centerLabel="Logged" centerValue={Math.round(totals.kcal) + " kcal"} height={210} />;
}

function ProjectStatusWidget() {
  const tasks = useCollection<Task>("projects", "tasks");
  const items = [{ id: "todo", name: "To do", value: tasks.rows.filter((row) => !row.deleted && row.status === "todo").length }, { id: "progress", name: "In progress", value: tasks.rows.filter((row) => !row.deleted && row.status === "in_progress").length }, { id: "review", name: "In review", value: tasks.rows.filter((row) => !row.deleted && row.status === "review").length }, { id: "done", name: "Completed", value: tasks.rows.filter((row) => !row.deleted && row.status === "done").length }];
  return <CategoryBreakdownChart data={items} formatValue={(value) => Number(value ?? 0) + " tasks"} centerLabel="Tasks" centerValue={String(items.reduce((sum, row) => sum + row.value, 0))} height={210} />;
}

export const CHART_WIDGETS: ChartWidgetDef[] = [
  { id: "budget.monthly", tool: "budget", title: "Monthly income vs expenses", description: "Annual Budget · all 12 months", Component: BudgetMonthlyWidget },
  { id: "budget.categories", tool: "budget", title: "Spending by category", description: "Annual Budget · expense breakdown", Component: BudgetCategoriesWidget },
  { id: "net-worth.assets", tool: "net-worth", title: "Asset Allocation", description: "Net Worth · current values grouped by category", Component: NetWorthAllocationWidget },
  { id: "net-worth.growth", tool: "net-worth", title: "Net Worth Growth", description: "Net Worth · recorded snapshot history", Component: NetWorthGrowthWidget },
  { id: "savings.goals", tool: "savings", title: "Savings goal progress", description: "Savings · contributions vs targets", Component: SavingsGoalsWidget },
  { id: "savings.balance-trend", tool: "savings", title: "Savings Balance Trend", description: "Savings · last 12 months of dated activity", Component: SavingsBalanceWidget },
  { id: "savings.emergency-coverage", tool: "savings", title: "Emergency Fund Coverage", description: "Savings · verified essential expense baseline", Component: SavingsEmergencyWidget },
  { id: "savings.next-milestone", tool: "savings", title: "Next Savings Milestone", description: "Savings · upcoming goal target", Component: SavingsMilestoneWidget },
  { id: "savings.monthly-needed", tool: "savings", title: "Monthly Contribution Requirement", description: "Savings · combined current monthly target", Component: SavingsMonthlyNeedWidget },
  { id: "nutrition.weekly", tool: "nutrition", title: "Weekly calories", description: "Nutrition · last 7 days", Component: NutritionWeeklyWidget },
  { id: "projects.completion", tool: "projects", title: "Task completion", description: "Projects · overall progress", Component: ProjectsCompletionWidget },
  { id: "inventory.lowstock", tool: "inventory", title: "Low-stock products", description: "Inventory · items needing reorder", Component: InventoryLowStockWidget },
  { id: "bookkeeping.revenue", tool: "bookkeeping", title: "Revenue trend", description: "Bookkeeping · monthly revenue", Component: BookkeepingRevenueWidget },
  { id: "sales.revenue", tool: "sales", title: "Sales revenue trend", description: "Sales · recorded net revenue", Component: SalesRevenueWidget },
  { id: "invoicing.outstanding", tool: "invoicing", title: "Receivables status", description: "Invoices · linked payments and outstanding balances", Component: InvoiceCollectionsWidget },
  { id: "cash-flow.forecast", tool: "cash-flow", title: "Projected cash balance", description: "Cash Flow · saved 13-week scenario", Component: CashForecastWidget },
  { id: "wedding.budget", tool: "wedding", title: "Wedding budget allocation", description: "Wedding · committed amounts by category", Component: WeddingBudgetWidget },
  { id: "property.revenue", tool: "property", title: "Rental revenue trend", description: "Property · non-cancelled booking revenue", Component: PropertyRevenueWidget },
  { id: "habits.today", tool: "habits", title: "Today's habit check-ins", description: "Habits · scheduled completions", Component: HabitTodayWidget },
  { id: "content.pipeline", tool: "content", title: "Content pipeline", description: "Content · current saved post statuses", Component: ContentPipelineWidget },
  { id: "bookkeeping.expenses", tool: "bookkeeping", title: "Expenses by category", description: "Bookkeeping · cash-basis recorded expenses", Component: BookkeepingExpensesWidget },
  { id: "inventory.value", tool: "inventory", title: "Inventory value by category", description: "Inventory · weighted-average cost", Component: InventoryValueWidget },
  { id: "sales.products", tool: "sales", title: "Sales by product", description: "Sales · net amounts after returns and discounts", Component: SalesProductsWidget },
  { id: "property.expenses", tool: "property", title: "Rental expenses by category", description: "Property · recorded operating expenses", Component: PropertyExpenseWidget },
  { id: "nutrition.macros", tool: "nutrition", title: "Daily macro balance", description: "Nutrition · logged food only", Component: NutritionMacrosWidget },
  { id: "projects.status", tool: "projects", title: "Task status", description: "Projects · current task records", Component: ProjectStatusWidget },
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

const COLLECTION_FILTERS = ["all", "money", "business", "life", "work"] as const;
type CollectionFilter = (typeof COLLECTION_FILTERS)[number];

function DashboardWidgetCatalog({ onClose, kpis, selectedKpis, onToggleKpi, onMoveKpi, onRestoreKpis }: { onClose: () => void; kpis: { id: string; label: string }[]; selectedKpis: string[]; onToggleKpi: (id: string) => void; onMoveKpi: (id: string, direction: -1 | 1) => void; onRestoreKpis: () => void }) {
  const { t } = useI18n();
  const { prefs, setPrefs } = usePrefs();
  const { active } = useActiveTools();
  const [query, setQuery] = React.useState("");
  const [collection, setCollection] = React.useState<CollectionFilter>("all");
  const pins = (prefs.pinnedCharts ?? []) as PinnedChart[];
  const widgets = CHART_WIDGETS.filter((widget) => active.includes(widget.tool));
  const visible = widgets.filter((widget) => {
    const tool = TOOL_MAP[widget.tool];
    const matchesCollection = collection === "all" || tool?.collection === collection;
    const haystack = `${widget.title} ${widget.description} ${tool?.shortName ?? ""}`.toLocaleLowerCase();
    return matchesCollection && haystack.includes(query.trim().toLocaleLowerCase());
  });
  const toggleWidget = async (widget: ChartWidgetDef) => {
    try {
      const next = isPinned(pins, widget.id)
        ? removePin(pins, widget.id)
        : addPin(pins, { id: widget.id, tool: widget.tool, chart: widget.id, title: widget.title });
      const sizes = { ...(prefs.pinnedChartSizes ?? {}) };
      if (isPinned(pins, widget.id)) delete sizes[widget.id];
      await setPrefs({ pinnedCharts: next, pinnedChartSizes: sizes });
      toast.success(t(isPinned(pins, widget.id) ? "Widget removed from dashboard" : "Widget added to dashboard"));
    } catch {
      toast.error(t("Could not save dashboard changes. Please try again."));
    }
  };
  const restoreDefaults = async () => {
    const recommended = ["budget.monthly", "savings.goals", "sales.revenue", "projects.completion"]
      .map((id) => CHART_WIDGETS.find((widget) => widget.id === id))
      .filter((widget): widget is ChartWidgetDef => Boolean(widget && active.includes(widget.tool)))
      .map((widget) => ({ id: widget.id, tool: widget.tool, chart: widget.id, title: widget.title }));
    try {
      await setPrefs({ pinnedCharts: recommended, pinnedChartSizes: {} });
      onRestoreKpis();
      toast.success(t("Recommended dashboard restored"));
    } catch {
      toast.error(t("Could not save dashboard changes. Please try again."));
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden">
      <div className="mb-4 flex min-w-0 items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{t("Customize Dashboard")}</h2>
          <p className="mt-1 text-[12px] text-fg-muted">{t("Choose what matters most to you.")}</p>
          <p className="mt-1 text-[11px] text-fg-subtle">{t("{count} widgets added", { count: pins.length })}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" className="max-sm:px-2 max-sm:text-[11px]" onClick={restoreDefaults}>{t("Restore defaults")}</Button>
          <Button variant="ghost" size="icon-sm" icon="close" aria-label={t("Close customization")} onClick={onClose} />
        </div>
      </div>
      <label className="mb-3 flex h-10 w-full min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-xl border border-line bg-[var(--bg-subtle)] px-3">
        <AnimatedIcon name="search" size={15} className="text-fg-subtle" trigger="none" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search widgets")} className="block h-full w-full min-w-0 flex-1 bg-transparent text-[13px] text-fg outline-none placeholder:text-fg-subtle" />
      </label>
      <div className="no-scrollbar mb-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label={t("Filter widgets by collection")}>
        {COLLECTION_FILTERS.map((filter) => (
          <button key={filter} role="tab" aria-selected={collection === filter} onClick={() => setCollection(filter)} className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-medium ${collection === filter ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "border border-line text-fg-muted hover:bg-[var(--surface-hover)]"}`}>
            {t(filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1))}
          </button>
        ))}
      </div>
      <section className="mb-3 rounded-xl border border-line bg-[var(--surface)]/55 p-3" aria-label={t("Overview KPIs")}>
        <div className="mb-2 flex items-center justify-between"><h3 className="text-[12px] font-semibold">{t("Overview KPIs")}</h3><span className="text-[10px] text-fg-subtle">{selectedKpis.length}/4</span></div>
        <div className="min-w-0 space-y-1.5">
          {kpis.map((kpi) => {
            const selected = selectedKpis.includes(kpi.id);
            return <div key={kpi.id} className="flex min-w-0 w-full items-center gap-1.5 overflow-hidden rounded-lg border border-line px-2 py-2"><span className="min-w-0 flex-1 truncate text-[11.5px]">{t(kpi.label)}</span>{selected ? <><button type="button" aria-label={t("Move KPI up")} onClick={() => onMoveKpi(kpi.id, -1)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line text-fg-muted hover:bg-[var(--surface-hover)]"><AnimatedIcon name="chevronUp" size={12} trigger="none" /></button><button type="button" aria-label={t("Move KPI down")} onClick={() => onMoveKpi(kpi.id, 1)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line text-fg-muted hover:bg-[var(--surface-hover)]"><AnimatedIcon name="chevronDown" size={12} trigger="none" /></button></> : null}<Button size="sm" variant={selected ? "secondary" : "primary"} className="shrink-0" disabled={!selected && selectedKpis.length >= 4} onClick={() => onToggleKpi(kpi.id)}>{t(selected ? "Remove" : "Add")}</Button></div>;
          })}
          {!kpis.length ? <p className="text-[11px] text-fg-subtle">{t("Relevant KPIs appear when an activated tool has records.")}</p> : null}
        </div>
      </section>
      <div className="min-h-0 min-w-0 w-full max-w-full flex-1 space-y-2 overflow-x-hidden overflow-y-auto pr-1">
        {visible.map((widget) => {
          const tool = TOOL_MAP[widget.tool];
          const added = isPinned(pins, widget.id);
          return (
            <div key={widget.id} className="flex min-w-0 w-full items-center gap-3 overflow-hidden rounded-xl border border-line bg-[var(--surface)]/75 p-3">
              <ToolIcon toolId={widget.tool} size={17} trigger="none" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium">{t(widget.title)}</p>
                <p className="truncate text-[11px] text-fg-subtle">{t(tool?.shortName ?? "")} · {t(widget.description)}</p>
              </div>
              <Button size="sm" variant={added ? "secondary" : "primary"} className="shrink-0" onClick={() => void toggleWidget(widget)}>{t(added ? "Remove" : "Add")}</Button>
            </div>
          );
        })}
        {!visible.length ? <p className="py-8 text-center text-[12px] text-fg-subtle">{t("No widgets match your search.")}</p> : null}
      </div>
    </div>
  );
}

export function DashboardCustomizePanel({ open, onClose, kpis, selectedKpis, onToggleKpi, onMoveKpi, onRestoreKpis }: { open: boolean; onClose: () => void; kpis: { id: string; label: string }[]; selectedKpis: string[]; onToggleKpi: (id: string) => void; onMoveKpi: (id: string, direction: -1 | 1) => void; onRestoreKpis: () => void }) {
  const [desktop, setDesktop] = React.useState(false);
  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  if (desktop) return <LazyMotion features={domAnimation}><m.aside id="dashboard-customize-panel" aria-label="Dashboard customization" aria-hidden={!open} inert={!open} className="glass-strong sticky top-4 hidden h-[calc(100dvh-7rem)] shrink-0 overflow-hidden rounded-2xl p-4 xl:flex" initial={{ width: 0, opacity: 0 }} animate={{ width: open ? 360 : 0, opacity: open ? 1 : 0 }} transition={{ duration: 0.28, ease: "easeInOut" }}><m.div className="h-full w-[328px] min-w-[328px]" initial={false} animate={{ x: open ? 0 : 380 }} transition={{ duration: 0.28, ease: "easeInOut" }}><DashboardWidgetCatalog onClose={onClose} kpis={kpis} selectedKpis={selectedKpis} onToggleKpi={onToggleKpi} onMoveKpi={onMoveKpi} onRestoreKpis={onRestoreKpis} /></m.div></m.aside></LazyMotion>;
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent id="dashboard-customize-panel" title="Customize Dashboard" description="Choose what matters most to you." wide className="!box-border !fixed !left-0 !top-auto !bottom-0 !max-h-[88dvh] !w-full !max-w-none !translate-x-0 !translate-y-0 !overflow-x-hidden !rounded-b-none !rounded-t-[24px] !p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] xl:hidden">
        <DashboardWidgetCatalog onClose={onClose} kpis={kpis} selectedKpis={selectedKpis} onToggleKpi={onToggleKpi} onMoveKpi={onMoveKpi} onRestoreKpis={onRestoreKpis} />
      </DialogContent>
    </Dialog>
  );
}

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

export function ChartWidgetCard({ pin, size = "half" }: { pin: PinnedChart; size?: "half" | "full" }) {
  const def = getWidget(pin.id);
  const { prefs, setPrefs } = usePrefs();
  const { active } = useActiveTools();
  const pins = (prefs.pinnedCharts ?? []) as PinnedChart[];

  if (!def) return null;
  const toolActive = active.includes(def.tool);

  if (!toolActive) {
    return (
      <ChartContainer title={def.title} subtitle={def.description} icon="lock" className={size === "full" ? "lg:col-span-2" : undefined}>
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
      className={size === "full" ? "lg:col-span-2" : undefined}
      action={
        <div className="flex items-center gap-1.5">
          <OfflineBadge />
          <button
            type="button"
            aria-label={size === "full" ? "Use half-width widget" : "Use full-width widget"}
            title={size === "full" ? "Use half width" : "Use full width"}
            onClick={() => setPrefs({ pinnedChartSizes: { ...(prefs.pinnedChartSizes ?? {}), [pin.id]: size === "full" ? "half" : "full" } })}
            className="press grid h-7 min-w-7 place-items-center rounded-lg border border-line px-1.5 text-[10px] font-semibold text-fg-muted hover:bg-[var(--surface-strong)] hover:text-fg"
          >
            {size === "full" ? "½" : "↔"}
          </button>
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
      <div className="grid gap-3 lg:grid-cols-2">
        {pins.map((pin, index) => (
          <ChartWidgetCard key={pin.id} pin={pin} size={prefs.pinnedChartSizes?.[pin.id] ?? (index === 0 ? "full" : "half")} />
        ))}
      </div>
  );
}
