import { D, formatPercent, maxZero, pct, ratio, round2, sumBy, toNum } from "../money";
import type {
  Debt,
  DebtPayment,
  GoalMovement,
  Holding,
  MoneyBudget,
  MoneyCategory,
  MoneyTransaction,
  NetWorthItem,
  Paycheck,
  PaycheckAllocation,
  SavingsGoal,
  ValuationSnapshot,
} from "../types";

/* ==========================================================================
   Period helpers
   ========================================================================== */

export type PeriodKey = string; // 'YYYY-MM' | 'YYYY' | 'all'

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function yearOf(date: string): string {
  return date.slice(0, 4);
}

export function matchesPeriod(date: string, period: PeriodKey): boolean {
  if (!period || period === "all") return true;
  if (period.length === 4) return date.slice(0, 4) === period;
  return date.slice(0, 7) === period;
}

export function monthsInYear(year: string): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentYear(): string {
  return String(new Date().getFullYear());
}

/* ==========================================================================
   MONEY TOOL 1 — Annual Budget
   ========================================================================== */

export interface BudgetSummary {
  income: number;
  expenses: number;
  netCashFlow: number;
  savingsTransfers: number;
  /** Internal transfers, excluded from income and expenses. */
  transfers: number;
  savingsRate: number | null;
  budgetAllocation: number;
  budgetRemaining: number;
  transactionCount: number;
  byCategory: CategorySpend[];
  monthly: MonthlyPoint[];
  avgMonthlySpending: number | null;
  completeMonths: number;
  currency: string;
}

export interface CategorySpend {
  categoryId: string;
  name: string;
  kind: "income" | "expense";
  actual: number;
  budget: number;
  variance: number;
  variancePct: number | null;
}

export interface MonthlyPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface BudgetInput {
  transactions: MoneyTransaction[];
  categories: MoneyCategory[];
  budgets: MoneyBudget[];
  period: PeriodKey;
  /** Month used to resolve which category budgets apply. */
  budgetMonth?: string;
  currency?: string;
}

/**
 * Income and expenses use posted transactions only.
 * Internal transfers and savings movements are excluded from both totals so a
 * transfer from checking to savings never inflates income or spending.
 */
export function budgetSummary(input: BudgetInput): BudgetSummary {
  const { transactions, categories, budgets, period } = input;
  const posted = transactions.filter(
    (t) => !t.deleted && t.status === "posted" && matchesPeriod(t.date, period),
  );

  const incomeTx = posted.filter((t) => t.type === "income");
  const expenseTx = posted.filter((t) => t.type === "expense");
  const transferTx = posted.filter((t) => t.type === "transfer");
  const savingsTx = posted.filter((t) => t.type === "savings");

  const income = round2(sumBy(incomeTx, (t) => t.amount));
  const expenses = round2(sumBy(expenseTx, (t) => t.amount));
  const transfers = round2(sumBy(transferTx, (t) => t.amount));
  const savingsTransfers = round2(sumBy(savingsTx, (t) => t.amount));
  const netCashFlow = round2(D(income).minus(expenses));

  const budgetMonth = input.budgetMonth ?? (period.length === 7 ? period : currentMonth());
  const activeBudgets = budgets.filter((b) => !b.deleted && b.month === budgetMonth);
  const allocation = round2(sumBy(activeBudgets, (b) => b.amount));

  const catMap = new Map(categories.map((c) => [c.id, c]));
  const spendMap = new Map<string, { actual: number; budget: number }>();

  for (const tx of [...incomeTx, ...expenseTx]) {
    const key = tx.categoryId || "uncategorized";
    const prev = spendMap.get(key) ?? { actual: 0, budget: 0 };
    prev.actual = round2(D(prev.actual).plus(tx.amount));
    spendMap.set(key, prev);
  }
  for (const b of activeBudgets) {
    const prev = spendMap.get(b.categoryId) ?? { actual: 0, budget: 0 };
    prev.budget = round2(D(prev.budget).plus(b.amount));
    spendMap.set(b.categoryId, prev);
  }

  const byCategory: CategorySpend[] = [...spendMap.entries()]
    .map(([id, v]) => {
      const cat = catMap.get(id);
      return {
        categoryId: id,
        name: cat?.name ?? "Uncategorized",
        kind: (cat?.kind ?? "expense") as "income" | "expense",
        actual: v.actual,
        budget: v.budget,
        variance: round2(D(v.budget).minus(v.actual)),
        variancePct: pct(D(v.budget).minus(v.actual), v.budget),
      };
    })
    .sort((a, b) => b.actual - a.actual);

  // Monthly series across the period
  const months =
    period.length === 4
      ? monthsInYear(period)
      : period === "all"
        ? [...new Set(posted.map((t) => monthOf(t.date)))].sort()
        : [period];

  const monthly: MonthlyPoint[] = months.map((m) => {
    const inc = round2(sumBy(posted.filter((t) => t.type === "income" && monthOf(t.date) === m), (t) => t.amount));
    const exp = round2(sumBy(posted.filter((t) => t.type === "expense" && monthOf(t.date) === m), (t) => t.amount));
    return { month: m, income: inc, expenses: exp, net: round2(D(inc).minus(exp)) };
  });

  const today = new Date();
  const completeMonths = months.filter((m) => {
    const [y, mo] = m.split("-").map(Number);
    if (!y || !mo) return false;
    return new Date(y, mo, 1) <= new Date(today.getFullYear(), today.getMonth(), 1);
  }).length;

  // A brand-new user with no records must read "N/A", not "$0". Dividing zero expenses by
  // a complete month yields a confident-looking 0 that says "you spend nothing", which is a
  // different claim from "there is nothing to average yet".
  const hasExpenseData = posted.some((t) => t.type === "expense");

  return {
    income,
    expenses,
    netCashFlow,
    savingsTransfers,
    transfers,
    savingsRate: income > 0 ? pct(netCashFlow, income) : null,
    budgetAllocation: allocation,
    budgetRemaining: round2(D(allocation).minus(expenses)),
    transactionCount: posted.length,
    byCategory,
    monthly,
    avgMonthlySpending: completeMonths > 0 && hasExpenseData ? round2(D(expenses).div(completeMonths)) : null,
    completeMonths,
    currency: input.currency ?? "USD",
  };
}

export function accountBalance(
  openingBalance: number,
  transactions: MoneyTransaction[],
  accountId: string,
): number {
  let bal = D(openingBalance);
  for (const t of transactions) {
    if (t.deleted || t.status !== "posted") continue;
    const amt = D(t.amount);
    if (t.type === "income" && t.accountId === accountId) bal = bal.plus(amt);
    if (t.type === "expense" && t.accountId === accountId) bal = bal.minus(amt);
    if (t.type === "savings" && t.accountId === accountId) bal = bal.minus(amt);
    if ((t.type === "transfer" || t.type === "savings") && t.toAccountId === accountId) bal = bal.plus(amt);
    if (t.type === "transfer" && t.accountId === accountId) bal = bal.minus(amt);
  }
  return round2(bal);
}

/* ==========================================================================
   MONEY TOOL 2 — Paycheck planner
   ========================================================================== */

export interface PaycheckSummary {
  income: number;
  plannedBills: number;
  plannedSpending: number;
  allocatedSavings: number;
  available: number;
  remaining: number;
  paidBills: number;
  daysUntilNextPaycheck: number | null;
  dailyAllowance: number | null;
  currency: string;
}

export function paycheckSummary(
  paycheck: Paycheck,
  allocations: PaycheckAllocation[],
  opts: { nextPayDate?: string; extraActualSpending?: number; today?: string; currency?: string } = {},
): PaycheckSummary {
  const active = allocations.filter((a) => !a.deleted && a.paycheckId === paycheck.id);
  const income = toNum(paycheck.actualAmount ?? paycheck.expectedAmount);

  // Paid bills are counted once: their planned amount is replaced by the actual payment.
  const plannedBills = round2(
    sumBy(active.filter((a) => a.kind === "bill" && !a.paid), (a) => a.amount),
  );
  const paidBills = round2(sumBy(active.filter((a) => a.kind === "bill" && a.paid), (a) => a.amount));
  const plannedSpending = round2(sumBy(active.filter((a) => a.kind === "spending"), (a) => a.amount));
  const allocatedSavings = round2(
    D(sumBy(active.filter((a) => a.kind === "savings"), (a) => a.amount)).plus(
      paycheck.savingsAllocation ?? 0,
    ),
  );

  const available = round2(D(income).minus(plannedBills).minus(paidBills).minus(plannedSpending).minus(allocatedSavings));
  const remaining = round2(D(available).minus(opts.extraActualSpending ?? 0));

  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  let days: number | null = null;
  if (opts.nextPayDate) {
    const diff = Math.round(
      (new Date(`${opts.nextPayDate}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) /
        86_400_000,
    );
    days = Math.max(0, diff);
  }

  return {
    income,
    plannedBills,
    plannedSpending,
    allocatedSavings,
    available,
    remaining,
    paidBills,
    daysUntilNextPaycheck: days,
    dailyAllowance: days && days > 0 ? round2(D(remaining).div(days)) : null,
    currency: opts.currency ?? "USD",
  };
}

export function nextPayDate(
  frequency: "weekly" | "biweekly" | "semimonthly" | "monthly",
  from: string,
  today = new Date(),
): string {
  const d = new Date(`${from}T00:00:00`);
  const t = new Date(today.toISOString().slice(0, 10) + "T00:00:00");
  const step = () => {
    if (frequency === "weekly") d.setDate(d.getDate() + 7);
    else if (frequency === "biweekly") d.setDate(d.getDate() + 14);
    else if (frequency === "semimonthly") d.setDate(d.getDate() + 15);
    else d.setMonth(d.getMonth() + 1);
  };
  let guard = 0;
  while (d < t && guard < 400) {
    step();
    guard++;
  }
  return d.toISOString().slice(0, 10);
}

/* ==========================================================================
   MONEY TOOL 3 — Debt payoff
   ========================================================================== */

export type PayoffStrategy = "snowball" | "avalanche";

export interface DebtInput {
  id: string;
  name: string;
  balance: number;
  annualRate: number;
  minimumPayment: number;
}

export interface DebtScheduleRow {
  month: number;
  date: string;
  debtId: string;
  debtName: string;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export interface DebtSimulation {
  strategy: PayoffStrategy;
  rows: DebtScheduleRow[];
  monthlyBalances: { month: number; date: string; total: number; balances: { debtId: string; name: string; balance: number }[] }[];
  months: number;
  payoffDate: string;
  totalInterest: number;
  totalPaid: number;
  /** True when minimums never reduce principal — the plan cannot amortise. */
  nonAmortizing: boolean;
  perDebt: {
    debtId: string;
    name: string;
    payoffMonth: number;
    payoffDate: string;
    interest: number;
    paid: number;
  }[];
}

const MAX_MONTHS = 720;

/**
 * Deterministic monthly simulation.
 *
 * Conventions:
 * - Interest accrues monthly at annualRate / 12 on the opening balance.
 * - Each month every live debt receives its minimum (capped at balance + interest).
 * - The extra payment, plus minimums freed by paid-off debts, is applied to the
 *   target debt: smallest balance (snowball) or highest rate (avalanche).
 * - Payments never take a balance below zero; the final payment is reduced.
 * - Rounding: interest is rounded to 2dp each month (lender-typical), balances to 2dp.
 */
export function simulateDebt(
  debts: DebtInput[],
  extraPayment: number,
  strategy: PayoffStrategy,
  startDate = new Date(),
): DebtSimulation {
  const live = debts
    .filter((d) => d.balance > 0)
    .map((d) => ({ ...d, balance: round2(d.balance) }));

  const rows: DebtScheduleRow[] = [];
  const monthlyBalances: DebtSimulation["monthlyBalances"] = [];
  const perDebt = new Map<string, { interest: number; paid: number; payoffMonth: number }>();
  for (const d of live) perDebt.set(d.id, { interest: 0, paid: 0, payoffMonth: 0 });

  const order = [...live].sort((a, b) =>
    strategy === "snowball" ? a.balance - b.balance : b.annualRate - a.annualRate,
  );

  const monthlyRate = (d: DebtInput) => d.annualRate / 100 / 12;
  const totalMinimum = round2(sumBy(live, (d) => d.minimumPayment));
  const budget = round2(D(totalMinimum).plus(Math.max(0, extraPayment)));

  // Non-amortizing detection: no payment can ever reduce the largest interest burden.
  const firstInterest = round2(sumBy(live, (d) => D(d.balance).times(monthlyRate(d))));
  const nonAmortizing = live.length > 0 && D(budget).lessThanOrEqualTo(firstInterest);

  let month = 0;
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (live.some((d) => d.balance > 0) && month < MAX_MONTHS) {
    month += 1;
    const date = new Date(cursor.getFullYear(), cursor.getMonth() + month - 1, 1)
      .toISOString()
      .slice(0, 10);

    let remainingBudget = budget;

    // 1. Accrue interest
    for (const d of live) {
      if (d.balance <= 0) continue;
      const interest = round2(D(d.balance).times(monthlyRate(d)));
      d.balance = round2(D(d.balance).plus(interest));
      (d as DebtInput & { _interest?: number })._interest = interest;
    }

    // 2. Minimums
    for (const d of live) {
      if (d.balance <= 0 || remainingBudget <= 0) continue;
      const interest = (d as DebtInput & { _interest?: number })._interest ?? 0;
      const due = Math.min(d.minimumPayment, d.balance);
      const pay = Math.min(due, remainingBudget);
      if (pay <= 0) continue;
      const principal = round2(D(pay).minus(interest));
      d.balance = round2(D(d.balance).minus(pay));
      remainingBudget = round2(D(remainingBudget).minus(pay));
      const rec = perDebt.get(d.id)!;
      rec.interest = round2(D(rec.interest).plus(interest));
      rec.paid = round2(D(rec.paid).plus(pay));
      if (d.balance <= 0) rec.payoffMonth = rec.payoffMonth || month;
      rows.push({
        month,
        date,
        debtId: d.id,
        debtName: d.name,
        payment: round2(pay),
        interest,
        principal,
        balance: Math.max(0, d.balance),
      });
    }

    // 3. Extra to the strategy target, cascading when one closes
    while (remainingBudget > 0) {
      const target = order.find((d) => d.balance > 0);
      if (!target) break;
      const interest = (target as DebtInput & { _interest?: number })._interest ?? 0;
      const pay = Math.min(remainingBudget, target.balance);
      target.balance = round2(D(target.balance).minus(pay));
      remainingBudget = round2(D(remainingBudget).minus(pay));
      const rec = perDebt.get(target.id)!;
      rec.paid = round2(D(rec.paid).plus(pay));
      if (target.balance <= 0 && !rec.payoffMonth) rec.payoffMonth = month;
      rows.push({
        month,
        date,
        debtId: target.id,
        debtName: target.name,
        payment: round2(pay),
        interest,
        principal: round2(D(pay).minus(interest)),
        balance: Math.max(0, target.balance),
      });
    }

    // Any debt that reached zero this month is removed from further accrual
    for (const d of live) if (d.balance <= 0) d.balance = 0;

    monthlyBalances.push({
      month,
      date,
      total: round2(sumBy(live, (debt) => Math.max(0, debt.balance))),
      balances: live.map((debt) => ({ debtId: debt.id, name: debt.name, balance: Math.max(0, debt.balance) })),
    });
  }

  const payoffDate = new Date(cursor.getFullYear(), cursor.getMonth() + month, 1)
    .toISOString()
    .slice(0, 10);

  const totalInterest = round2(sumBy([...perDebt.values()], (r) => r.interest));
  const totalPaid = round2(sumBy([...perDebt.values()], (r) => r.paid));

  return {
    strategy,
    rows,
    monthlyBalances,
    months: month,
    payoffDate,
    totalInterest,
    totalPaid,
    nonAmortizing,
    perDebt: live.map((d) => {
      const rec = perDebt.get(d.id)!;
      return {
        debtId: d.id,
        name: d.name,
        payoffMonth: rec.payoffMonth,
        payoffDate: new Date(cursor.getFullYear(), cursor.getMonth() + (rec.payoffMonth || month), 1)
          .toISOString()
          .slice(0, 10),
        interest: rec.interest,
        paid: rec.paid,
      };
    }),
  };
}

export function debtTotals(debts: Debt[]) {
  const active = debts.filter((d) => !d.deleted);
  return {
    count: active.length,
    balance: round2(sumBy(active, (d) => d.openingPrincipal)),
    minimums: round2(sumBy(active, (d) => d.minimumPayment)),
    avgRate:
      active.length > 0
        ? round2(D(sumBy(active, (d) => D(d.annualRate).times(d.openingPrincipal))).div(
            Math.max(1, toNum(sumBy(active, (d) => d.openingPrincipal))),
          ))
        : 0,
  };
}

export function debtPaymentsTotal(payments: DebtPayment[]) {
  return round2(sumBy(payments.filter((p) => !p.deleted), (p) => p.amount));
}

/* ==========================================================================
   MONEY TOOL 4 — Savings goals
   ========================================================================== */

export interface GoalSummary {
  id: string;
  name: string;
  target: number;
  balance: number;
  remaining: number;
  progressPct: number | null;
  contributions: number;
  withdrawals: number;
  monthsLeft: number | null;
  requiredMonthly: number | null;
  onTrack: boolean | null;
  overdue: boolean;
  monthsOfCover: number | null;
}

export function goalSummary(goal: SavingsGoal, movements: GoalMovement[], today = new Date()): GoalSummary {
  const active = movements.filter((m) => !m.deleted && m.goalId === goal.id);
  const contributions = round2(sumBy(active.filter((m) => m.kind === "contribution"), (m) => m.amount));
  const withdrawals = round2(sumBy(active.filter((m) => m.kind === "withdrawal"), (m) => m.amount));
  const balance = round2(D(goal.openingBalance).plus(contributions).minus(withdrawals));
  const target = toNum(goal.targetAmount);
  const remaining = maxZero(D(target).minus(balance));

  let monthsLeft: number | null = null;
  let overdue = false;
  if (goal.targetDate) {
    const t = new Date(`${goal.targetDate}T00:00:00`);
    overdue = t < today && remaining > 0;
    monthsLeft = Math.max(
      0,
      (t.getFullYear() - today.getFullYear()) * 12 + (t.getMonth() - today.getMonth()),
    );
  }

  const requiredMonthly =
    monthsLeft && monthsLeft > 0 ? round2(D(remaining).div(monthsLeft)) : remaining > 0 ? null : 0;

  const monthsOfCover =
    goal.kind === "emergency" && goal.monthlyEssentials && goal.monthlyEssentials > 0
      ? round2(D(balance).div(goal.monthlyEssentials))
      : null;

  return {
    id: goal.id,
    name: goal.name,
    target,
    balance,
    remaining,
    progressPct: target > 0 ? pct(balance, target) : null,
    contributions,
    withdrawals,
    monthsLeft,
    requiredMonthly,
    onTrack: requiredMonthly === null ? null : requiredMonthly <= Math.max(0, balance / Math.max(1, monthsLeft ?? 1)),
    overdue,
    monthsOfCover,
  };
}

export function savingsTotals(goals: SavingsGoal[], movements: GoalMovement[]) {
  const summaries = goals.filter((g) => !g.deleted).map((g) => goalSummary(g, movements));
  return {
    goals: summaries,
    balance: round2(sumBy(summaries, (s) => s.balance)),
    target: round2(sumBy(summaries, (s) => s.target)),
    progressPct: pct(
      sumBy(summaries, (s) => s.balance),
      sumBy(summaries, (s) => s.target),
    ),
    emergencyMonths:
      summaries.filter((s) => s.monthsOfCover !== null).sort((a, b) => (b.monthsOfCover ?? 0) - (a.monthsOfCover ?? 0))[0]
        ?.monthsOfCover ?? null,
  };
}

/* ==========================================================================
   MONEY TOOL 5 — Net worth
   ========================================================================== */

export interface NetWorthSummary {
  assets: number;
  liabilities: number;
  netWorth: number;
  byCurrency: { currency: string; assets: number; liabilities: number; net: number }[];
  holdingsValue: number;
  holdingsCost: number;
  unrealizedGain: number;
  unrealizedGainPct: number | null;
  change: number | null;
  changePct: number | null;
  history: { date: string; netWorth: number }[];
}

export function netWorthSummary(
  items: NetWorthItem[],
  holdings: Holding[],
  snapshots: ValuationSnapshot[],
  currency = "USD",
): NetWorthSummary {
  // Values in different currencies are never added together without an explicit FX rate.
  const live = items.filter((i) => !i.deleted && (i.currency || "USD") === currency);
  const assets = round2(sumBy(live.filter((i) => i.kind === "asset"), (i) => i.value));
  const liabilities = round2(sumBy(live.filter((i) => i.kind === "liability"), (i) => i.value));

  const liveHoldings = holdings.filter((h) => !h.deleted && (h.currency || "USD") === currency);
  const holdingsValue = round2(sumBy(liveHoldings, (h) => round2(Number(h.quantity) * Number(h.unitPrice))));
  const assetIds = new Set(live.filter((item) => item.kind === "asset").map((item) => item.id));
  const holdingsCountedAsAssets = liveHoldings.filter((holding) => !holding.parentAssetId || !assetIds.has(holding.parentAssetId));
  const nonDuplicatedHoldingValue = round2(sumBy(holdingsCountedAsAssets, (h) => round2(Number(h.quantity) * Number(h.unitPrice))));
  const holdingsWithBasis = liveHoldings.filter((h) => Number(h.costBasis) > 0);
  const holdingsCost = round2(sumBy(holdingsWithBasis, (h) => h.costBasis));
  const unrealizedGain = round2(sumBy(holdingsWithBasis, (h) => D(h.quantity).times(h.unitPrice).minus(h.costBasis)));

  const currencies = new Set<string>([...live.map((i) => i.currency || "USD"), ...liveHoldings.map((h) => h.currency || "USD")]);
  const byCurrency = [...currencies].map((currency) => {
    const a = round2(
      D(sumBy(live.filter((i) => i.kind === "asset" && (i.currency || "USD") === currency), (i) => i.value)).plus(
        sumBy(holdingsCountedAsAssets.filter((h) => (h.currency || "USD") === currency), (h) => round2(Number(h.quantity) * Number(h.unitPrice))),
      ),
    );
    const l = round2(sumBy(live.filter((i) => i.kind === "liability" && (i.currency || "USD") === currency), (i) => i.value));
    return { currency, assets: a, liabilities: l, net: round2(D(a).minus(l)) };
  });

  const sorted = snapshots
    .filter((s) => !s.deleted && (s.currency || "USD") === currency)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const current = round2(D(assets).plus(nonDuplicatedHoldingValue).minus(liabilities));
  const previous = sorted.length >= 1 ? round2(D(sorted[sorted.length - 1].totalAssets).minus(sorted[sorted.length - 1].totalLiabilities)) : null;
  const change = previous === null ? null : round2(D(current).minus(previous));

  return {
    assets: round2(D(assets).plus(nonDuplicatedHoldingValue)),
    liabilities,
    netWorth: current,
    byCurrency,
    holdingsValue,
    holdingsCost,
    unrealizedGain,
    unrealizedGainPct: pct(unrealizedGain, holdingsCost),
    change,
    // Percentage growth is not meaningful from zero/negative starting wealth or across a sign change.
    changePct: change === null || previous === null || previous <= 0 || current < 0 ? null : round2(D(change).div(previous).times(100)),
    history: [
      ...sorted.map((s) => ({ date: s.date, netWorth: round2(D(s.totalAssets).minus(s.totalLiabilities)) })),
      { date: new Date().toISOString().slice(0, 10), netWorth: current },
    ],
  };
}

/** Snapshot of the current balance sheet, ready to persist. */
export function makeSnapshot(
  summary: NetWorthSummary,
  currency: string,
  date = new Date().toISOString().slice(0, 10),
): Omit<ValuationSnapshot, "id" | "createdAt" | "updatedAt"> {
  return {
    date,
    totalAssets: summary.assets,
    totalLiabilities: summary.liabilities,
    currency,
  };
}

/** Formatting helper shared by dashboard widgets. */
export function describeBudgetHealth(s: BudgetSummary): {
  tone: "positive" | "warning" | "negative";
  label: string;
} {
  if (s.transactionCount === 0) return { tone: "warning", label: "No transactions yet" };
  if (s.netCashFlow < 0) return { tone: "negative", label: `Overspending ${formatPercent(s.savingsRate)} of income` };
  if (s.savingsRate !== null && s.savingsRate >= 20) return { tone: "positive", label: "Healthy savings rate" };
  return { tone: "warning", label: "Positive but thin margin" };
}

export { ratio };
