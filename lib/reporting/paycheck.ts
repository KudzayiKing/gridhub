import { D, round2, sumBy } from "@/lib/money";
import type { DebtPayment, Paycheck, PaycheckAllocation, RecurringBill } from "@/lib/types";

export interface PaycheckAllocationSlice {
  id: "bill" | "debt" | "spending" | "savings" | "unallocated";
  name: string;
  value: number;
}

export interface MonthlyBillOccurrence {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  linked: boolean;
}

function localISODate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Reconciles a paycheck to non-overlapping planned allocation slices.
 * `Paycheck.savingsAllocation` predates allocation rows and may represent the same
 * reservation, so use the larger savings value instead of summing both sources.
 */
export function paycheckAllocationBreakdown(
  paycheck: Paycheck,
  allocations: PaycheckAllocation[],
  debtPayments: DebtPayment[] = [],
): { amount: number; allocated: number; unallocated: number; overallocated: number; slices: PaycheckAllocationSlice[] } {
  const active = allocations.filter((row) => !row.deleted && row.paycheckId === paycheck.id);
  const bills = round2(sumBy(active.filter((row) => row.kind === "bill"), (row) => Math.max(0, row.amount)));
  const spending = round2(sumBy(active.filter((row) => row.kind === "spending"), (row) => Math.max(0, row.amount)));
  const rowSavings = sumBy(active.filter((row) => row.kind === "savings"), (row) => Math.max(0, row.amount));
  const savings = round2(Math.max(Number(rowSavings), Math.max(0, paycheck.savingsAllocation ?? 0)));
  const debt = round2(debtPayments
    .filter((row) => !row.deleted && row.paycheckId === paycheck.id && row.status !== "skipped")
    .reduce((sum, row) => sum + Math.max(0, row.amount), 0));
  const amount = round2(Math.max(0, paycheck.actualAmount ?? paycheck.expectedAmount));
  const allocated = round2(D(bills).plus(debt).plus(spending).plus(savings));
  const unallocated = round2(Math.max(0, Number(D(amount).minus(allocated))));
  const overallocated = round2(Math.max(0, Number(D(allocated).minus(amount))));
  const slices: PaycheckAllocationSlice[] = ([
    { id: "bill", name: "Bills", value: bills },
    { id: "debt", name: "Debt payments", value: debt },
    { id: "spending", name: "Everyday spending", value: spending },
    { id: "savings", name: "Savings", value: savings },
    { id: "unallocated", name: "Unallocated", value: unallocated },
  ] as PaycheckAllocationSlice[]).filter((slice) => slice.value > 0);
  return { amount, allocated, unallocated, overallocated, slices };
}

/** Monthly-only templates have enough data to locate a bill. Other frequencies lack a next date. */
export function monthlyBillOccurrences(
  bills: RecurringBill[],
  startDate: string,
  endDate: string,
  paychecks: Paycheck[],
  allocations: PaycheckAllocation[],
): MonthlyBillOccurrence[] {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return [];
  const occurrences: MonthlyBillOccurrence[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor < end) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    const lastDay = new Date(year, month, 0).getDate();
    for (const bill of bills) {
      if (bill.deleted || !bill.active || bill.frequency !== "monthly") continue;
      const day = Math.min(Math.max(1, Math.floor(bill.dueDay)), lastDay);
      const dueDate = `${monthKey}-${String(day).padStart(2, "0")}`;
      if (dueDate < startDate || dueDate >= endDate) continue;
      const matchingPaycheckIds = new Set(paychecks.filter((p) => p.date.startsWith(monthKey)).map((p) => p.id));
      const linkedRows = allocations.filter((a) => !a.deleted && matchingPaycheckIds.has(a.paycheckId) && a.kind === "bill" && a.label.trim().toLowerCase() === bill.name.trim().toLowerCase());
      occurrences.push({
        id: `${bill.id}:${dueDate}`,
        name: bill.name,
        amount: Math.max(0, bill.amount),
        dueDate,
        paid: linkedRows.some((row) => row.paid),
        linked: linkedRows.length > 0,
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return occurrences.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
}

export function nextPaydayDate(
  frequency: "weekly" | "biweekly" | "semimonthly" | "monthly",
  nextPayDate: string,
  today: string,
): string | null {
  const parsed = new Date(`${nextPayDate}T00:00:00`);
  const todayDate = new Date(`${today}T00:00:00`);
  if (!Number.isFinite(parsed.getTime()) || !Number.isFinite(todayDate.getTime())) return null;
  const anchorDay = parsed.getDate();
  let guard = 0;
  while (parsed < todayDate && guard++ < 500) {
    if (frequency === "weekly") parsed.setDate(parsed.getDate() + 7);
    else if (frequency === "biweekly") parsed.setDate(parsed.getDate() + 14);
    else if (frequency === "semimonthly") parsed.setDate(parsed.getDate() + 15);
    else {
      const nextMonth = parsed.getMonth() + 1;
      parsed.setDate(1);
      parsed.setMonth(nextMonth);
      const lastDay = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0).getDate();
      parsed.setDate(Math.min(anchorDay, lastDay));
    }
  }
  return guard >= 500 ? null : localISODate(parsed);
}

