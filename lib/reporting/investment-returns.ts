import type { InvestmentTransaction, ValuationSnapshot } from "@/lib/types";
import { round2 } from "@/lib/money";

export interface DatedCashFlow {
  date: string;
  amount: number;
}

export interface InvestmentReturnResult {
  annualizedPct: number | null;
  reason?: string;
}

export interface TimeWeightedReturnResult {
  cumulativePct: number | null;
  annualizedPct: number | null;
  periods: number;
  reason?: string;
}

const dayNumber = (date: string) => Date.parse(date + "T00:00:00Z") / 86400000;
const amountOf = (value: number) => Math.abs(Number.isFinite(value) ? value : 0);

/** Investor-perspective flows. Internal reinvestments and fees already reflected in NAV are excluded. */
export function investmentXirrFlows(transactions: InvestmentTransaction[]): DatedCashFlow[] {
  return transactions.filter((row) => !row.deleted).flatMap((row) => {
    const amount = amountOf(row.amount);
    if (!amount || !row.date) return [];
    if (row.kind === "contribution") return [{ date: row.date, amount: -amount }];
    if (row.kind === "withdrawal") return [{ date: row.date, amount }];
    if (row.kind === "dividend" || row.kind === "interest") return row.reinvested ? [] : [{ date: row.date, amount }];
    if (row.kind === "fee") return row.paidFromPortfolio ? [] : [{ date: row.date, amount: -amount }];
    return [];
  });
}

/** Portfolio-perspective external flows for TWR: contributions are positive; withdrawals are negative. */
function externalPortfolioFlow(row: InvestmentTransaction): number {
  const amount = amountOf(row.amount);
  if (row.kind === "contribution") return amount;
  if (row.kind === "withdrawal") return -amount;
  if ((row.kind === "dividend" || row.kind === "interest") && !row.reinvested) return -amount;
  return 0;
}

function xnpv(rate: number, flows: DatedCashFlow[], origin: number): number {
  if (rate <= -1) return Number.POSITIVE_INFINITY;
  let total = 0;
  for (const flow of flows) {
    const exponent = (dayNumber(flow.date) - origin) / 365;
    const factor = Math.pow(1 + rate, exponent);
    const term = flow.amount / factor;
    if (!Number.isFinite(term)) return Math.sign(flow.amount) * Number.MAX_VALUE;
    total += term;
  }
  return total;
}

function bisectXnpv(low: number, high: number, lowValue: number, flows: DatedCashFlow[], origin: number): number | null {
  for (let iteration = 0; iteration < 180; iteration++) {
    const mid = (low + high) / 2;
    const midValue = xnpv(mid, flows, origin);
    if (!Number.isFinite(midValue)) return null;
    if (Math.abs(midValue) < 1e-8 || high - low < 1e-12) return mid;
    if (Math.sign(midValue) === Math.sign(lowValue)) {
      low = mid;
      lowValue = midValue;
    } else high = mid;
  }
  return (low + high) / 2;
}

/** Annualized money-weighted return. Returns unavailable when cash flows have no unique numeric root. */
export function calculateXirr(
  transactions: InvestmentTransaction[],
  endingValue: number,
  asOfDate: string,
): InvestmentReturnResult {
  if (!Number.isFinite(endingValue) || endingValue < 0 || !asOfDate) return { annualizedPct: null, reason: "A valid dated portfolio value is required." };
  const flows = investmentXirrFlows(transactions).filter((flow) => flow.date <= asOfDate && Number.isFinite(dayNumber(flow.date)));
  if (endingValue > 0) flows.push({ date: asOfDate, amount: endingValue });
  const ordered = flows.sort((a, b) => a.date.localeCompare(b.date));
  if (ordered.length < 2 || !ordered.some((flow) => flow.amount < 0) || !ordered.some((flow) => flow.amount > 0)) {
    return { annualizedPct: null, reason: "Record at least one invested amount and a dated positive distribution or ending portfolio value." };
  }
  const origin = dayNumber(ordered[0].date);
  if (!Number.isFinite(origin) || dayNumber(asOfDate) <= origin) return { annualizedPct: null, reason: "The investment cash-flow history needs more than one calendar date." };

  const grid = [-0.9999, -0.99, -0.9, -0.75, -0.5, -0.25, 0, 0.1, 0.25, 0.5, 1, 2, 5, 10, 100, 1000, 10000];
  const roots: number[] = [];
  for (let index = 1; index < grid.length; index++) {
    const low = grid[index - 1];
    const high = grid[index];
    const lowValue = xnpv(low, ordered, origin);
    const highValue = xnpv(high, ordered, origin);
    if (!Number.isFinite(lowValue) || !Number.isFinite(highValue) || Math.sign(lowValue) === Math.sign(highValue)) continue;
    const root = bisectXnpv(low, high, lowValue, ordered, origin);
    if (root != null && !roots.some((existing) => Math.abs(existing - root) < 1e-7)) roots.push(root);
  }
  if (roots.length !== 1) return { annualizedPct: null, reason: roots.length ? "These cash flows produce more than one possible XIRR; no single return is reported." : "No numeric XIRR solution was found for these dated cash flows." };
  return { annualizedPct: round2(roots[0] * 100) };
}

/**
 * Calculates TWR only across consecutive snapshot periods with no external cash flows.
 * Periods containing flows require before/after-flow valuations and are reported unavailable.
 */
export function calculateTimeWeightedReturn(
  snapshots: ValuationSnapshot[],
  transactions: InvestmentTransaction[],
): TimeWeightedReturnResult {
  const ordered = snapshots.filter((row) => !row.deleted && row.investmentValue != null && Number.isFinite(Number(row.investmentValue)))
    .slice().sort((a, b) => a.date.localeCompare(b.date));
  if (ordered.length < 2) return { cumulativePct: null, annualizedPct: null, periods: 0, reason: "At least two dated portfolio valuations are required." };
  if (new Set(ordered.map((row) => row.date)).size !== ordered.length) return { cumulativePct: null, annualizedPct: null, periods: 0, reason: "Duplicate valuation dates make the return periods ambiguous." };
  let growthFactor = 1;
  let periods = 0;
  const liveTransactions = transactions.filter((row) => !row.deleted && externalPortfolioFlow(row) !== 0);
  for (let index = 1; index < ordered.length; index++) {
    const start = ordered[index - 1];
    const end = ordered[index];
    const startValue = Number(start.investmentValue);
    const endValue = Number(end.investmentValue);
    if (startValue <= 0 || endValue < 0) return { cumulativePct: null, annualizedPct: null, periods, reason: "Time-weighted return needs positive starting valuations and non-negative ending valuations." };
    const crossesFlow = liveTransactions.some((row) => row.date >= start.date && row.date <= end.date);
    if (crossesFlow) return { cumulativePct: null, annualizedPct: null, periods, reason: "A period contains an external cash flow. Record portfolio valuations immediately before and after it to calculate TWR without estimating." };
    growthFactor *= endValue / startValue;
    periods++;
  }
  const firstDate = ordered[0].date;
  const lastDate = ordered[ordered.length - 1].date;
  const years = (dayNumber(lastDate) - dayNumber(firstDate)) / 365;
  const cumulativePct = round2((growthFactor - 1) * 100);
  return {
    cumulativePct,
    annualizedPct: years > 0 && growthFactor >= 0 ? round2((Math.pow(growthFactor, 1 / years) - 1) * 100) : null,
    periods,
  };
}
