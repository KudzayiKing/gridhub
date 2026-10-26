import { round2 } from "@/lib/money";
import type { Debt, DebtPayment } from "@/lib/types";

export type DebtPayStrategy = "snowball" | "avalanche";
export type DebtPaymentState = "upcoming" | "due-soon" | "paid" | "partial" | "overdue" | "planned" | "skipped";

export interface DebtDueOccurrence {
  id: string;
  debtId: string;
  debtName: string;
  date: string;
  amount: number;
  paidAmount: number;
  status: DebtPaymentState;
  paycheckId?: string;
}

export function localISODate(date: Date): string {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86_400_000);
}

function clampedDate(year: number, month: number, day: number): string {
  const last = new Date(year, month + 1, 0).getDate();
  return year + "-" + String(month + 1).padStart(2, "0") + "-" + String(Math.min(Math.max(1, day), last)).padStart(2, "0");
}

/** Build due dates only when the user supplied an explicit contractual date/day. */
export function debtDueOccurrences(
  debts: Debt[],
  payments: DebtPayment[],
  from: string,
  to: string,
  today: string,
): DebtDueOccurrence[] {
  if (to < from) return [];
  const events: DebtDueOccurrence[] = [];
  for (const debt of debts) {
    if (debt.deleted || debt.openingPrincipal <= 0) continue;
    const dates: string[] = [];
    if (debt.frequency === "biweekly") {
      if (!debt.nextDueDate) continue;
      const cursor = new Date(debt.nextDueDate + "T00:00:00");
      if (!Number.isFinite(cursor.getTime())) continue;
      let guard = 0;
      while (localISODate(cursor) < from && guard++ < 500) cursor.setDate(cursor.getDate() + 14);
      while (localISODate(cursor) <= to && guard++ < 1000) {
        dates.push(localISODate(cursor));
        cursor.setDate(cursor.getDate() + 14);
      }
    } else {
      const anchor = debt.dueDay ?? (debt.nextDueDate ? Number(debt.nextDueDate.slice(8, 10)) : null);
      if (!anchor) continue;
      const first = new Date(from + "T00:00:00");
      const last = new Date(to + "T00:00:00");
      const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
      while (cursor <= last) {
        const date = clampedDate(cursor.getFullYear(), cursor.getMonth(), anchor);
        if (date >= from && date <= to && (!debt.createdAt || date >= debt.createdAt.slice(0, 10))) dates.push(date);
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }
    for (const date of dates) {
      const actuals = payments.filter((payment) =>
        !payment.deleted &&
        payment.debtId === debt.id &&
        payment.status !== "planned" &&
        payment.status !== "skipped" &&
        (debt.frequency === "monthly"
          ? payment.date.slice(0, 7) === date.slice(0, 7)
          : Math.abs(daysBetween(date, payment.date)) <= 6),
      );
      const paidAmount = round2(actuals.reduce((sum, payment) => sum + Math.max(0, payment.amount), 0));
      const plan = payments.find((payment) => !payment.deleted && payment.debtId === debt.id && payment.status === "planned" && payment.date === date);
      const skipped = payments.some((payment) => !payment.deleted && payment.debtId === debt.id && payment.status === "skipped" && payment.date === date);
      const status: DebtPaymentState =
        skipped ? "skipped" :
        paidAmount >= debt.minimumPayment && paidAmount > 0 ? "paid" :
        paidAmount > 0 ? "partial" :
        plan ? "planned" :
        date < today ? "overdue" :
        daysBetween(today, date) <= 3 ? "due-soon" : "upcoming";
      events.push({
        id: "debt-due:" + debt.id + ":" + date,
        debtId: debt.id,
        debtName: debt.name,
        date,
        amount: Math.max(0, plan?.amount ?? debt.minimumPayment),
        paidAmount,
        status,
        paycheckId: plan?.paycheckId ?? actuals.find((payment) => payment.paycheckId)?.paycheckId,
      });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.debtName.localeCompare(b.debtName));
}

export function debtPaymentHistory(payments: DebtPayment[], months: number, endMonth: string): {
  month: string;
  actual: number;
  principal: number;
  interest: number;
  fees: number;
}[] {
  const end = new Date(endMonth + "-01T00:00:00");
  const start = new Date(end.getFullYear(), end.getMonth() - months + 1, 1);
  const result = Array.from({ length: months }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const month = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
    return { month, actual: 0, principal: 0, interest: 0, fees: 0 };
  });
  const byMonth = new Map(result.map((row) => [row.month, row]));
  for (const payment of payments) {
    if (payment.deleted || payment.status === "planned" || payment.status === "skipped") continue;
    const row = byMonth.get(payment.date.slice(0, 7));
    if (!row) continue;
    row.actual = round2(row.actual + Math.max(0, payment.amount));
    row.principal = round2(row.principal + Math.max(0, payment.principal ?? 0));
    row.interest = round2(row.interest + Math.max(0, payment.interest ?? 0));
    row.fees = round2(row.fees + Math.max(0, payment.fees ?? 0));
  }
  return result;
}

/** Progress is an estimate unless a lender-confirmed original principal snapshot exists. */
export function estimatedDebtProgress(debt: Debt, payments: DebtPayment[]) {
  const principalPaid = round2(payments
    .filter((payment) => !payment.deleted && payment.debtId === debt.id && payment.status !== "planned" && payment.status !== "skipped")
    .reduce((sum, payment) => sum + Math.max(0, payment.principal ?? 0), 0));
  const current = Math.max(0, debt.openingPrincipal);
  const estimatedOriginal = round2(current + principalPaid);
  return {
    current,
    principalPaid,
    estimatedOriginal,
    progressPercent: estimatedOriginal > 0 ? Math.min(100, round2(principalPaid / estimatedOriginal * 100)) : 0,
    estimate: principalPaid > 0,
  };
}

export function paymentSplitIsValid(total: number, principal?: number, interest?: number, fees = 0): boolean {
  if (principal == null && interest == null) return true;
  if (principal == null || interest == null || [total, principal, interest, fees].some((value) => !Number.isFinite(value) || value < 0)) return false;
  return Math.abs(round2(principal + interest + fees) - round2(total)) <= 0.01;
}

export function reminderMatches(occurrenceDate: string, today: string, leadDays: number[] = []): boolean {
  const remaining = daysBetween(today, occurrenceDate);
  return leadDays.includes(remaining) && remaining >= 0;
}
