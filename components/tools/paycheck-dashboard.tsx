"use client";

import * as React from "react";
import { CartesianGrid, LineChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CompactMetric, Badge } from "@/components/ui/card";
import { ChartContainer, ChartEmptyState, ChartPeriodSelector, MonthlyComparisonChart, BudgetVsActualChart, CategoryBreakdownChart, ProgressChart, StackedBarChart } from "@/components/charts";
import { useCollection } from "@/lib/store";
import { usePrefs } from "@/components/providers";
import { useToolPeriod } from "@/lib/use-tool-period";
import { accountBalance, budgetSummary, currentMonth, goalSummary } from "@/lib/calc/money";
import { formatMoney, formatPercent, round2 } from "@/lib/money";
import { paycheckAllocationBreakdown, monthlyBillOccurrences, nextPaydayDate } from "@/lib/reporting/paycheck";
import { rows } from "@/lib/tools/shared";
import type { DataMap } from "@/lib/tools/shared";
import type { DebtPayment, GoalMovement, MoneyAccount, MoneyBudget, MoneyCategory, MoneyTransaction, PaySchedule, Paycheck, PaycheckAllocation, RecurringBill, SavingsGoal } from "@/lib/types";
import { PinChartButton } from "@/lib/chart-widgets";

type Mode = "monthly" | "paycheck";
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const TODAY = () => localDate(new Date());
const isoMonth = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const dateLabel = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

export function PaycheckDashboard({ data, currency, onOpenAllocations }: { data: DataMap; currency: string; onOpenAllocations: () => void }) {
  const { prefs, setPrefs } = usePrefs();
  const transactions = useCollection<MoneyTransaction>("budget", "transactions");
  const categories = useCollection<MoneyCategory>("budget", "categories");
  const budgets = useCollection<MoneyBudget>("budget", "budgets");
  const bills = useCollection<RecurringBill>("budget", "bills");
  const accounts = useCollection<MoneyAccount>("budget", "accounts");
  const goals = useCollection<SavingsGoal>("savings", "goals");
  const movements = useCollection<GoalMovement>("savings", "movements");
  const debtPaymentRecords = useCollection<DebtPayment>("debt", "payments");
  const debtPayments = debtPaymentRecords.rows;
  const moneyRows = React.useMemo(() => transactions.rows.filter((row) => !row.currency || row.currency === currency), [transactions.rows, currency]);
  const schedules = React.useMemo(() => rows<PaySchedule>(data, "schedules").filter((s) => !s.deleted), [data]);
  const paychecks = React.useMemo(() => rows<Paycheck>(data, "paychecks").filter((p) => !p.deleted && (!p.scheduleId || !schedules.some((s) => s.id === p.scheduleId) || schedules.find((s) => s.id === p.scheduleId)?.currency === currency)).sort((a, b) => a.date.localeCompare(b.date)), [data, schedules, currency]);
  const allocations = React.useMemo(() => rows<PaycheckAllocation>(data, "allocations"), [data]);
  const observedMonths = [
    ...moneyRows.map((r) => r.date),
    ...paychecks.map((r) => r.date),
  ].filter(Boolean).map((d) => d.slice(0, 7));
  const now = TODAY();
  const months = new Set<string>([currentMonth(), ...observedMonths]);
  for (let offset = 0; offset < 36; offset++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - offset);
    months.add(isoMonth(d));
  }
  const monthOptions = [...months].sort((a, b) => b.localeCompare(a)).map((value) => ({ value, label: new Date(`${value}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" }) }));
  const period = useToolPeriod("paycheck", monthOptions, currentMonth());
  const month = period.value;
  const monthPaychecks = paychecks.filter((p) => p.date.startsWith(month));
  const latestInPeriod = [...monthPaychecks].sort((a, b) => b.date.localeCompare(a.date))[0];
  const selectedPaycheckId = prefs.periods?.["paycheck-id"] ?? "";
  const setSelectedPaycheckId = (id: string) => void setPrefs({ periods: { ...(prefs.periods ?? {}), "paycheck-id": id } });
  const paycheck = monthPaychecks.find((p) => p.id === selectedPaycheckId) ?? latestInPeriod;
  const [selectedCategory, setSelectedCategory] = React.useState("");
  const [selectedAllocation, setSelectedAllocation] = React.useState("");
  const [range, setRange] = React.useState("12");
  const mode: Mode = prefs.periods?.["paycheck-view"] === "paycheck" ? "paycheck" : "monthly";
  const setMode = (next: Mode) => void setPrefs({ periods: { ...(prefs.periods ?? {}), "paycheck-view": next } });
  const fmt = React.useCallback((value: number | string | undefined) => formatMoney(Number(value ?? 0), { currency, maximumFractionDigits: 0 }), [currency]);

  const monthly = React.useMemo(() => budgetSummary({ transactions: moneyRows, categories: categories.rows, budgets: budgets.rows, period: month, currency }), [moneyRows, categories.rows, budgets.rows, month, currency]);
  const expenses = moneyRows.filter((t) => !t.deleted && t.status === "posted" && t.type === "expense" && t.date.startsWith(month) && (!selectedCategory || t.categoryId === selectedCategory));
  const categoryRows = monthly.byCategory.filter((row) => row.kind === "expense" && (row.budget > 0 || row.actual > 0) && (!selectedCategory || row.categoryId === selectedCategory)).map((row) => ({ category: row.name, categoryId: row.categoryId, budget: row.budget, actual: row.actual, variance: round2(row.budget - row.actual), used: row.budget > 0 ? row.actual / row.budget * 100 : null }));
  const categoryDonut = monthly.byCategory.filter((row) => row.kind === "expense" && row.actual > 0 && (!selectedCategory || row.categoryId === selectedCategory)).map((row) => ({ id: row.categoryId, name: row.name, value: row.actual }));
  const selectedAllocations = paycheck ? allocations.filter((a) => !a.deleted && a.paycheckId === paycheck.id) : [];
  const allocation = paycheck ? paycheckAllocationBreakdown(paycheck, selectedAllocations, debtPayments) : null;

  const periodChecks = monthPaychecks;
  const savingsTarget = periodChecks.reduce((total, check) => {
    const plannedRows = allocations.filter((a) => !a.deleted && a.paycheckId === check.id && a.kind === "savings").reduce((sum, row) => sum + Math.max(0, row.amount), 0);
    return total + plannedRows;
  }, 0);
  const linkedMovementIds = new Set(movements.rows.filter((m) => !m.deleted && m.transactionId).map((m) => m.transactionId));
  const savingsByDate = new Map<string, number>();
  for (const movement of movements.rows) if (!movement.deleted && movement.kind === "contribution" && movement.date.startsWith(month)) savingsByDate.set(movement.date, (savingsByDate.get(movement.date) ?? 0) + Math.max(0, movement.amount));
  for (const transaction of moneyRows) if (!transaction.deleted && transaction.status === "posted" && transaction.type === "savings" && transaction.date.startsWith(month) && !linkedMovementIds.has(transaction.id)) savingsByDate.set(transaction.date, (savingsByDate.get(transaction.date) ?? 0) + Math.max(0, transaction.amount));
  for (const check of monthPaychecks) if (check.savingsAllocation && check.savingsAllocation > 0) savingsByDate.set(check.date, Math.max(savingsByDate.get(check.date) ?? 0, check.savingsAllocation));
  const actualSavings = round2([...savingsByDate.values()].reduce((sum, amount) => sum + amount, 0));
  const savingsProgress = savingsTarget > 0 ? Math.min(100, actualSavings / savingsTarget * 100) : null;

  const upcomingPaydays = schedules.filter((schedule) => !schedule.currency || schedule.currency === currency).map((schedule) => ({ schedule, date: nextPaydayDate(schedule.frequency, schedule.nextPayDate, now) })).filter((item): item is { schedule: PaySchedule; date: string } => Boolean(item.date)).sort((a, b) => a.date.localeCompare(b.date));
  const nextRecordedPaycheck = paychecks.find((p) => p.date >= now);
  const nextPay = upcomingPaydays[0];
  const nextPayAmount = nextPay?.schedule.expectedAmount ?? nextRecordedPaycheck?.expectedAmount;
  const nextPayDateValue = nextPay?.date ?? nextRecordedPaycheck?.date;
  const nextPaySource = nextPay?.schedule.name ?? (nextRecordedPaycheck?.scheduleId ? schedules.find((s) => s.id === nextRecordedPaycheck.scheduleId)?.name : "Recorded paycheck");
  const daysToPay = nextPayDateValue ? Math.max(0, Math.ceil((new Date(`${nextPayDateValue}T00:00:00`).getTime() - new Date(`${now}T00:00:00`).getTime()) / 86_400_000)) : null;

  const startOfSelectedMonth = `${month}-01`;
  const nextMonth = new Date(`${month}-01T00:00:00`);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const endOfSelectedMonth = isoMonth(nextMonth) + "-01";
  const monthBillRows = monthlyBillOccurrences(bills.rows, startOfSelectedMonth, endOfSelectedMonth, paychecks, allocations).map((bill) => {
    const recordedExpense = moneyRows.some((tx) => !tx.deleted && tx.status === "posted" && tx.type === "expense" && tx.date === bill.dueDate && sameName(tx.description, bill.name));
    return { ...bill, paid: bill.paid || recordedExpense, recordedExpense };
  });
  const visibleBillRows = mode === "paycheck" && paycheck
    ? monthBillRows.filter((bill) => selectedAllocations.some((row) => row.kind === "bill" && sameName(row.label, bill.name)))
    : monthBillRows;
  const billsToReview = monthBillRows.filter((bill) => !bill.paid);
  const billsTotal = billsToReview.reduce((sum, bill) => sum + Math.max(0, bill.amount), 0);
  const overdueBillTotal = billsToReview.filter((bill) => bill.dueDate < now).reduce((sum, bill) => sum + Math.max(0, bill.amount), 0);
  const nearestBill = billsToReview.filter((bill) => bill.dueDate >= now).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const paycheckBills = selectedAllocations.filter((row) => row.kind === "bill" && !row.paid);
  const displayedBillsCount = mode === "paycheck" ? paycheckBills.length : billsToReview.length;
  const displayedBillsTotal = mode === "paycheck" ? paycheckBills.reduce((sum, row) => sum + Math.max(0, row.amount), 0) : billsTotal;
  const displayedBillsHint = mode === "paycheck" ? `${paycheckBills.length} linked bills not marked paid on this paycheck` : `${billsToReview.length} monthly bills not marked paid${overdueBillTotal > 0 ? ` · ${fmt(overdueBillTotal)} past due` : nearestBill ? ` · next ${dateLabel(nearestBill.dueDate)}` : ""}`;
  const availableAccounts = accounts.rows.filter((account) => ["checking", "cash"].includes(account.kind) && account.currency === currency);
  const verifiedBalance = availableAccounts.length ? availableAccounts.reduce((sum, account) => sum + accountBalance(account.openingBalance, moneyRows, account.id), 0) : null;
  const selectedPlanAmount = paycheck ? paycheckAllocationBreakdown(paycheck, selectedAllocations).unallocated : null;
  const upcomingScheduledBills = nextPayDateValue ? monthlyBillOccurrences(bills.rows, now, nextPayDateValue, paychecks, allocations).filter((bill) => !bill.paid && !moneyRows.some((tx) => !tx.deleted && tx.status === "posted" && tx.type === "expense" && tx.date === bill.dueDate && sameName(tx.description, bill.name))) : [];
  const estimatedSpendable = mode === "paycheck" ? selectedPlanAmount : verifiedBalance === null ? selectedPlanAmount : round2(verifiedBalance - upcomingScheduledBills.reduce((sum, bill) => sum + bill.amount, 0));
  const availableHint = mode === "paycheck" && paycheck ? `${paycheck.actualAmount == null ? "Expected" : "Received"} paycheck less assigned amounts · not bank cash` : verifiedBalance === null ? (paycheck ? `${paycheck.actualAmount == null ? "Expected" : "Received"} paycheck plan · estimate, not bank cash` : "Add checking or cash account balances") : nextPayDateValue ? "Checking/cash balance less scheduled bills before payday" : "Current checking/cash balances · no next payday set";

  const history = React.useMemo(() => {
    const selected = new Date(`${month}-01T00:00:00`);
    const count = Number(range);
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(selected.getFullYear(), selected.getMonth() - (count - 1 - i), 1);
      const key = isoMonth(d);
      const summary = budgetSummary({ transactions: moneyRows, categories: categories.rows, budgets: [], period: key, currency });
      return { month: key, income: summary.income, expenses: summary.expenses };
    });
  }, [month, range, moneyRows, categories.rows, currency]);

  const paycheckBreakdowns = monthPaychecks.map((check) => ({ paycheck: check, ...paycheckAllocationBreakdown(check, allocations, debtPayments) }));

  const forecast = (() => {
    if (verifiedBalance === null || !nextPayDateValue || nextPayDateValue <= now) return { points: [], lowest: 0, beforePayday: 0 };
    const days = Math.ceil((new Date(`${nextPayDateValue}T00:00:00`).getTime() - new Date(`${now}T00:00:00`).getTime()) / 86_400_000);
    if (days < 1 || days > 90) return { points: [], lowest: 0, beforePayday: 0 };
    const events = new Map<string, number>();
    for (const bill of upcomingScheduledBills) events.set(bill.dueDate, (events.get(bill.dueDate) ?? 0) - bill.amount);
    for (const tx of moneyRows) {
      if (tx.deleted || tx.type !== "expense" || tx.status !== "pending" || tx.date < now || tx.date >= nextPayDateValue) continue;
      const duplicatesBill = upcomingScheduledBills.some((bill) => bill.dueDate === tx.date && sameName(bill.name, tx.description));
      if (!duplicatesBill) events.set(tx.date, (events.get(tx.date) ?? 0) - tx.amount);
    }
    let balance = verifiedBalance;
    const points = [{ label: "Today", balance }];
    let lowest = balance;
    for (let offset = 1; offset < days; offset++) {
      const d = new Date(`${now}T00:00:00`);
      d.setDate(d.getDate() + offset);
      const date = localDate(d);
      balance = round2(balance + (events.get(date) ?? 0));
      lowest = Math.min(lowest, balance);
      points.push({ label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), balance });
    }
    return { points, lowest, beforePayday: balance };
  })();
  const dailyForecast = forecast.points;

  const selectedPaycheckLabel = paycheck ? `${dateLabel(paycheck.date)} · ${paycheck.actualAmount == null ? "Expected" : "Received"} ${fmt(paycheck.actualAmount ?? paycheck.expectedAmount)}` : "No paycheck in this month";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-full border border-line bg-[var(--bg-subtle)]/60 p-0.5" role="tablist" aria-label="Budget view">
          {(["monthly", "paycheck"] as const).map((value) => <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => setMode(value)} className={`press rounded-full px-3 py-1.5 text-[12px] font-medium capitalize ${mode === value ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-fg-muted hover:bg-[var(--surface-strong)]"}`}>{value === "monthly" ? "Monthly" : "Per Paycheck"}</button>)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="paycheck-month">Select month</label>
          <select id="paycheck-month" value={month} onChange={(e) => period.setValue(e.target.value)} className="h-9 rounded-full border border-line bg-[var(--surface)] px-3 text-[12px] text-fg">
            {monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {mode === "paycheck" ? <>
            <label className="sr-only" htmlFor="paycheck-select">Select paycheck</label>
            <select id="paycheck-select" value={paycheck?.id ?? ""} onChange={(e) => setSelectedPaycheckId(e.target.value)} className="h-9 max-w-[16rem] rounded-full border border-line bg-[var(--surface)] px-3 text-[12px] text-fg">
              {!monthPaychecks.length ? <option value="">No paychecks for this month</option> : monthPaychecks.map((check) => <option key={check.id} value={check.id}>{dateLabel(check.date)} · {check.actualAmount == null ? "Expected" : "Received"} · {fmt(check.actualAmount ?? check.expectedAmount)}</option>)}
            </select>
          </> : null}
        </div>
      </div>

      <div className="grid items-stretch gap-3 xl:grid-cols-2">
        <ChartContainer title="Paycheck allocation" subtitle={selectedPaycheckLabel} icon="wallet" action={<PinChartButton chartId="paycheck.allocation" title="Paycheck allocation" tool="paycheck" />}>
          {allocation ? <>
            {allocation.overallocated > 0 ? <p className="mb-2 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-2.5 py-2 text-[11px] text-[var(--warning)]">Allocations exceed this paycheck by {fmt(allocation.overallocated)}. Values are shown as planned; no negative donut slice is drawn.</p> : null}
            <CategoryBreakdownChart data={allocation.slices.map((slice) => ({ ...slice }))} formatValue={fmt} centerLabel={paycheck?.actualAmount == null ? "Expected" : "Received"} centerValue={fmt(allocation.amount)} onSliceClick={setSelectedAllocation} height={280} />
            {selectedAllocation ? <div className="mt-2 rounded-xl border border-line p-2 text-[11px]">{selectedAllocation === "unallocated" ? <p className="py-1 text-fg-muted">No assigned records · {fmt(allocation.unallocated)} remains available to allocate.</p> : selectedAllocation === "debt" ? debtPayments.filter((row) => row.paycheckId === paycheck?.id && row.status !== "skipped").map((row) => <p key={row.id} className="flex justify-between gap-2 border-b border-line py-1 last:border-0"><span>Debt payment · {row.date}{row.status === "planned" ? " · planned" : " · recorded"}</span><span className="tnum">{fmt(row.amount)}</span></p>) : selectedAllocations.filter((row) => row.kind === selectedAllocation).map((row) => <p key={row.id} className="flex justify-between gap-2 border-b border-line py-1 last:border-0"><span>{row.label}</span><span className="tnum">{fmt(row.amount)}</span></p>)}</div> : null}
          </> : <ChartEmptyState label="Add or select a paycheck to see its allocation" />}
        </ChartContainer>

        <section className="rounded-2xl border border-line bg-[var(--surface)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[12px] font-semibold">Paycheck summary</h3>
            <span className="text-[11px] text-fg-subtle">{month}</span>
          </div>
          <div className="grid auto-rows-fr grid-cols-2 gap-2">
            <CompactMetric label="Monthly income" value={fmt(monthly.income)} hint={`${moneyRows.filter((t) => !t.deleted && t.status === "posted" && t.type === "income" && t.date.startsWith(month)).length} posted transactions`} tone="positive" />
            <CompactMetric label="Next paycheck" value={nextPayAmount == null ? "Not scheduled" : fmt(nextPayAmount)} hint={nextPayDateValue ? `${dateLabel(nextPayDateValue)} · ${daysToPay} days${nextPaySource ? ` · ${nextPaySource}` : ""} · expected` : "Add a pay schedule with its next payday"} />
            <CompactMetric label="Bills still due" value={fmt(displayedBillsTotal)} hint={displayedBillsHint} tone={displayedBillsCount ? "negative" : "positive"} />
            <CompactMetric label="Available to spend" value={estimatedSpendable == null ? "Set up data" : fmt(estimatedSpendable)} hint={availableHint} tone={estimatedSpendable != null && estimatedSpendable < 0 ? "negative" : "neutral"} />
            <CompactMetric label="Budget remaining" value={fmt(monthly.budgetRemaining)} hint={monthly.budgetAllocation ? `${formatPercent(monthly.expenses / monthly.budgetAllocation * 100, 0)} used` : "No monthly category budget set"} tone={monthly.budgetRemaining < 0 ? "negative" : "neutral"} />
            <CompactMetric label="Savings progress" value={savingsTarget > 0 ? formatPercent(savingsProgress, 0) : "No target"} hint={savingsTarget > 0 ? `${fmt(actualSavings)} of ${fmt(savingsTarget)} planned · ${fmt(Math.max(0, savingsTarget - actualSavings))} to go` : `${fmt(actualSavings)} contributed · add savings allocations to set a target`} />
          </div>
        </section>
      </div>

      {mode === "paycheck" && monthPaychecks.length > 0 ? <p className="text-[11px] text-fg-muted">Selected paycheck: {selectedPaycheckLabel}. Amounts marked Expected are plans, not received income.</p> : null}

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartContainer title="Budget vs actual" subtitle={`${month} · tap a category to filter spending`} icon="target" action={<PinChartButton chartId="paycheck.budget-actual" title="Budget vs actual" tool="paycheck" />}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <label className="sr-only" htmlFor="paycheck-category">Filter by category</label>
            <select id="paycheck-category" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="h-8 max-w-full rounded-lg border border-line bg-[var(--surface)] px-2 text-[11px] text-fg"><option value="">All expense categories</option>{categories.rows.filter((c) => c.kind === "expense").map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
          </div>
          <BudgetVsActualChart data={categoryRows.map((row) => ({ category: row.category, budget: row.budget, actual: row.actual }))} formatValue={fmt} height={Math.max(170, categoryRows.length * 34 + 25)} onCategoryClick={(name) => setSelectedCategory(categories.rows.find((c) => c.name === name)?.id ?? "")} />
          {categoryRows.some((row) => row.variance < 0) ? <p className="mt-2 text-[11px] text-[var(--negative)]">Overspent categories are highlighted. A category without a budget has no percentage-used value.</p> : null}
        </ChartContainer>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartContainer title="Money left until next payday" subtitle={verifiedBalance === null ? "Add checking or cash account balances to build a cash forecast" : "Estimated cash after known future bills and pending expenses · not a bank guarantee"} icon="waves" action={<PinChartButton chartId="paycheck.payday-forecast" title="Money left until next payday" tool="paycheck" />}>
          {dailyForecast.length > 0 ? <div className="relative h-[220px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={dailyForecast} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="label" tick={{ fill: "var(--fg-subtle)", fontSize: 10 }} minTickGap={20} /><YAxis tick={{ fill: "var(--fg-subtle)", fontSize: 10 }} width={52} tickFormatter={(value) => fmt(value)} /><Tooltip formatter={(value) => fmt(Number(value))} /><ReferenceLine y={0} stroke="var(--negative)" strokeDasharray="4 3" /><Line dataKey="balance" name="Projected available" stroke={forecast.lowest < 0 ? "var(--negative)" : "var(--accent)"} strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div> : <ChartEmptyState label="Forecast unavailable: set a verified account balance and an upcoming pay schedule within 90 days" />}
          {dailyForecast.length ? <p className="mt-1 text-[11px] text-fg-muted">Lowest projected balance: {fmt(forecast.lowest)} · before payday: {fmt(forecast.beforePayday)}</p> : null}
        </ChartContainer>

        <ChartContainer title="Bills timeline" subtitle={`${month} · monthly recurring bills only; payment status comes from linked paycheck allocations`} icon="calendar-days" action={<PinChartButton chartId="paycheck.bills" title="Bills still due" tool="paycheck" />}>
          {visibleBillRows.length ? <div className="flex max-h-[280px] flex-col gap-1.5 overflow-y-auto">{visibleBillRows.map((bill) => {
            const days = Math.ceil((new Date(`${bill.dueDate}T00:00:00`).getTime() - new Date(`${now}T00:00:00`).getTime()) / 86_400_000);
            const status = bill.paid ? "Paid" : days < 0 ? "Past due · verify" : days <= 7 ? "Due soon" : "Upcoming";
            return <div key={bill.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-[var(--bg-subtle)]/40 px-3 py-2"><div className="min-w-0"><p className="truncate text-[12px] font-medium">{bill.name}</p><p className="text-[10.5px] text-fg-subtle">Due {dateLabel(bill.dueDate)}{bill.recordedExpense ? " · matching expense recorded" : bill.linked ? " · linked paycheck" : " · not linked to a paycheck"}</p></div><div className="shrink-0 text-right"><p className="tnum text-[12px]">{fmt(bill.amount)}</p><Badge tone={bill.paid ? "positive" : days < 0 ? "warning" : "neutral"}>{status}</Badge><button type="button" onClick={onOpenAllocations} className="mt-1 block text-[10px] text-fg-muted underline">Review allocation</button></div></div>;
          })}</div> : <ChartEmptyState label={mode === "paycheck" && paycheck ? "No recurring bill templates are linked to this paycheck" : "Add monthly recurring bills to create the bill timeline"} />}
          {bills.rows.some((bill) => bill.active && bill.frequency !== "monthly") ? <p className="mt-2 text-[10.5px] text-fg-subtle">Weekly and annual templates need a next-occurrence date in the bill data before they can be safely placed here.</p> : null}
        </ChartContainer>
      </div>

      <details className="group rounded-2xl border border-line bg-[var(--surface)] p-3" open>
        <summary className="cursor-pointer list-none text-[13px] font-semibold">Additional insights <span className="ml-1 text-[11px] font-normal text-fg-subtle">Monthly trends, savings, spending and paycheck comparisons</span></summary>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <ChartContainer title="Monthly income vs expenses" subtitle={`${range} months ending ${month}`} icon="chart-column" action={<><ChartPeriodSelector options={[{ value: "3", label: "3M" }, { value: "6", label: "6M" }, { value: "12", label: "12M" }]} value={range} onChange={setRange} /><PinChartButton chartId="paycheck.monthly-trend" title="Monthly income vs expenses" tool="paycheck" /></>}>
            <MonthlyComparisonChart data={history} formatValue={fmt} selectedMonth={month} onMonthClick={(selected) => period.setValue(selected)} height={220} />
          </ChartContainer>
          <ChartContainer title="Savings allocation progress" subtitle="Recorded contributions compared with the selected month's planned savings" icon="piggy-bank">
            {savingsTarget > 0 ? <ProgressChart items={[{ id: "monthly-savings", label: "Monthly savings", value: actualSavings, target: savingsTarget, formatValue: fmt, caption: `${fmt(Math.max(0, savingsTarget - actualSavings))} remaining${actualSavings > savingsTarget ? " · goal exceeded" : ""}` }]} /> : <ChartEmptyState label="Assign savings to a paycheck to define a monthly target" />}
            {goals.rows.length ? <div className="mt-3 border-t border-line pt-2">{goals.rows.filter((goal) => !goal.deleted).slice(0, 4).map((goal) => { const current = goalSummary(goal, movements.rows); return <p key={goal.id} className="flex justify-between gap-2 py-1 text-[11px]"><span className="truncate">{goal.name}</span><span className="tnum shrink-0">{fmt(current.balance)} / {fmt(goal.targetAmount)}</span></p>; })}</div> : null}
          </ChartContainer>
          <ChartContainer title="Monthly spending breakdown" subtitle={`${fmt(monthly.expenses)} actual posted expenses · tap a slice to inspect transactions`} icon="tag">
            <CategoryBreakdownChart data={categoryDonut} formatValue={fmt} centerLabel="Spent" centerValue={fmt(selectedCategory ? categoryDonut.reduce((s, row) => s + row.value, 0) : monthly.expenses)} onSliceClick={(id) => setSelectedCategory(id === selectedCategory ? "" : id)} height={220} />
            {selectedCategory ? <div className="mt-2 border-t border-line pt-2"><div className="mb-1 flex items-center justify-between"><p className="text-[11px] font-medium">{categories.rows.find((c) => c.id === selectedCategory)?.name ?? "Category"} transactions</p><button type="button" className="text-[10px] text-fg-muted underline" onClick={() => setSelectedCategory("")}>Clear filter</button></div>{expenses.length ? expenses.slice(0, 8).map((tx) => <p key={tx.id} className="flex justify-between gap-2 py-1 text-[10.5px]"><span className="truncate">{tx.description} · {dateLabel(tx.date)}</span><span className="tnum shrink-0">{fmt(tx.amount)}</span></p>) : <p className="py-2 text-[10.5px] text-fg-subtle">No posted expenses in this category for the selected month.</p>}</div> : null}
          </ChartContainer>
          <ChartContainer title="Paycheck comparison" subtitle="Each bar reconciles to received or expected paycheck allocations" icon="layers">
            {paycheckBreakdowns.length ? <>
              {paycheckBreakdowns.some((item) => item.overallocated > 0) ? <p className="mb-2 text-[10.5px] text-[var(--warning)]">One or more paychecks have allocations above their amount; those bars exceed the paycheck value.</p> : null}
              <StackedBarChart data={paycheckBreakdowns.map((item) => ({ label: `${new Date(`${item.paycheck.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${item.paycheck.actualAmount == null ? "Expected" : "Received"}`, bills: item.slices.find((slice) => slice.id === "bill")?.value ?? 0, debt: item.slices.find((slice) => slice.id === "debt")?.value ?? 0, spending: item.slices.find((slice) => slice.id === "spending")?.value ?? 0, savings: item.slices.find((slice) => slice.id === "savings")?.value ?? 0, unallocated: item.unallocated }))} xKey="label" series={[{ key: "bills", name: "Bills" }, { key: "debt", name: "Debt payments" }, { key: "spending", name: "Everyday spending" }, { key: "savings", name: "Savings" }, { key: "unallocated", name: "Unallocated" }]} formatValue={fmt} height={230} />
            </> : <ChartEmptyState label="Record paychecks to compare their allocations" />}
          </ChartContainer>
        </div>
      </details>
    </div>
  );
}
