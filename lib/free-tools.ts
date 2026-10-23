import { D, round2, sumBy, pct, type MoneyInput } from "@/lib/money";
import { simulateDebt, type DebtInput } from "@/lib/calc/money";
import Decimal from "decimal.js";

const zero = new Decimal(0);
const maxZeroDecimal = (value: MoneyInput) => D(value).lessThan(zero) ? zero : D(value);
const clampDecimal = (value: MoneyInput, min: number, max: number) => {
  const decimal = D(value);
  if (decimal.lessThan(min)) return new Decimal(min);
  if (decimal.greaterThan(max)) return new Decimal(max);
  return decimal;
};

export type FreeDebt = { id: string; name: string; balance: number; annualRate: number; minimumPayment: number };

export function calculateBudget(incomes: number[], expenses: { name: string; amount: number }[]) {
  const income = round2(sumBy(incomes, D));
  const totalExpenses = round2(sumBy(expenses, (e) => Math.max(0, e.amount)));
  return {
    income,
    expenses: totalExpenses,
    remaining: round2(D(income).minus(totalExpenses)),
    categories: expenses.map((e) => ({ ...e, amount: round2(Math.max(0, e.amount)), share: pct(e.amount, totalExpenses) ?? 0 })),
    guideline: { needs: round2(D(income).times(0.5)), wants: round2(D(income).times(0.3)), savings: round2(D(income).times(0.2)) },
  };
}

export function calculateDebt(debts: FreeDebt[], extra: number, startDate = new Date()) {
  const valid = debts.map((debt, index) => ({ ...debt, id: debt.id || String(index), balance: Math.max(0, debt.balance), annualRate: Math.max(0, debt.annualRate), minimumPayment: Math.max(0, debt.minimumPayment) }));
  const snowball = simulateDebt(valid as DebtInput[], Math.max(0, extra), "snowball", startDate);
  const avalanche = simulateDebt(valid as DebtInput[], Math.max(0, extra), "avalanche", startDate);
  const minimumOnly = simulateDebt(valid as DebtInput[], 0, "avalanche", startDate);
  const initialDebt = round2(sumBy(valid, (d) => d.balance));
  const monthlyMinimum = round2(sumBy(valid, (d) => d.minimumPayment));
  const paidOff = (simulation: typeof avalanche) => !simulation.nonAmortizing && simulation.perDebt.every((d) => d.payoffMonth > 0);
  return {
    initialDebt,
    monthlyMinimum,
    monthlyBudget: round2(D(monthlyMinimum).plus(Math.max(0, extra))),
    snowball,
    avalanche,
    minimumOnly,
    savings: round2(Math.max(0, minimumOnly.totalInterest - avalanche.totalInterest)),
    payoffAchievable: paidOff(avalanche),
    schedule: [...new Set(avalanche.rows.map((row) => row.month))]
      .filter((month) => month === 1 || month % 3 === 0)
      .map((month) => {
        const latest = new Map<string, number>();
        avalanche.rows.filter((row) => row.month === month).forEach((row) => latest.set(row.debtId, row.balance));
        return { month, balance: round2(sumBy([...latest.values()], (value) => value)) };
      }),
  };
}

export type RentalExpense = { name: string; amount: number; period: "monthly" | "annual" };
export function calculateRental(input: {
  price: number; downPayment: number; closingCosts: number; repairs: number; rent: number; otherIncome: number;
  vacancy: number; expenses: RentalExpense[]; rate: number; termYears: number;
}) {
  const months = Math.max(1, Math.min(1200, Math.round(input.termYears * 12)));
  const principal = maxZeroDecimal(D(input.price).minus(input.downPayment));
  const monthlyRate = maxZeroDecimal(input.rate).div(1200);
  const growth = monthlyRate.plus(1).pow(months);
  const payment = principal.isZero() ? new Decimal(0) : monthlyRate.isZero() ? principal.div(months) : principal.times(monthlyRate).div(growth.minus(1).div(growth));
  const vacancyFraction = clampDecimal(input.vacancy, 0, 100).div(100);
  const grossMonthly = maxZeroDecimal(input.rent).times(new Decimal(1).minus(vacancyFraction)).plus(maxZeroDecimal(input.otherIncome));
  const operatingMonthly = input.expenses.reduce((total, item) => total.plus(maxZeroDecimal(item.amount).div(item.period === "annual" ? 12 : 1)), new Decimal(0));
  const noi = grossMonthly.minus(operatingMonthly);
  const cashFlow = noi.minus(payment);
  const initialCash = maxZeroDecimal(input.downPayment).plus(maxZeroDecimal(input.closingCosts)).plus(maxZeroDecimal(input.repairs));
  return {
    principal: round2(principal), payment: round2(payment), grossMonthly: round2(grossMonthly), operatingMonthly: round2(operatingMonthly),
    noi: round2(noi), annualNoi: round2(noi.times(12)), cashFlow: round2(cashFlow), annualCashFlow: round2(cashFlow.times(12)),
    capRate: pct(noi.times(12), input.price), cashOnCash: pct(cashFlow.times(12), initialCash), initialCash: round2(initialCash),
    breakEvenOccupancy: D(input.rent).greaterThan(0) ? Math.min(100, Math.max(0, operatingMonthly.plus(payment).minus(maxZeroDecimal(input.otherIncome)).div(input.rent).times(100).toNumber())) : null,
    breakdown: [{ name: "Operating expenses", value: round2(operatingMonthly) }, { name: "Debt service", value: round2(payment) }, { name: "Cash flow", value: round2(cashFlow) }],
  };
}

export function calculateSavings(target: number, current: number, months: number, annualRate = 0) {
  const goal = Math.max(0, target);
  const saved = Math.max(0, current);
  const n = Math.max(0, Math.floor(months));
  const remainingDecimal = maxZeroDecimal(D(goal).minus(saved));
  const remaining = round2(remainingDecimal);
  const monthlyRate = maxZeroDecimal(annualRate).div(1200);
  const growth = monthlyRate.plus(1).pow(n);
  let contribution = n === 0 ? remainingDecimal : monthlyRate.isZero() ? remainingDecimal.div(n) : remainingDecimal.times(monthlyRate).div(growth.minus(1));
  if (!contribution.isFinite()) contribution = new Decimal(0);
  const chart = Array.from({ length: Math.min(n, 120) + 1 }, (_, i) => {
    const periods = monthlyRate.plus(1).pow(i);
    const futureValue = monthlyRate.isZero() ? D(saved).plus(contribution.times(i)) : D(saved).times(periods).plus(contribution.times(periods.minus(1)).div(monthlyRate));
    return { month: i, balance: round2(futureValue) };
  });
  const interest = maxZeroDecimal(D(chart[chart.length - 1].balance).minus(saved).minus(contribution.times(n)));
  return { target: round2(goal), current: round2(saved), remaining: round2(remaining), contribution: round2(contribution), progress: goal === 0 ? 100 : Math.min(100, round2(D(saved).div(goal).times(100))), months: n, interest: round2(interest), chart };
}

export function calculateProfit(sellingPrice: number, unitCost: number, quantity: number, discountPct = 0, targetMargin?: number) {
  const cost = Math.max(0, unitCost);
  const quantitySafe = Math.max(0, quantity);
  const netPrice = maxZeroDecimal(sellingPrice).times(new Decimal(1).minus(clampDecimal(discountPct, 0, 100).div(100)));
  const profit = netPrice.minus(cost);
  const requiredPrice = targetMargin !== undefined && targetMargin >= 0 && targetMargin < 100 ? D(cost).div(new Decimal(1).minus(D(targetMargin).div(100))) : null;
  return { netPrice: round2(netPrice), unitCost: round2(cost), unitProfit: round2(profit), margin: pct(profit, netPrice), markup: pct(profit, cost), revenue: round2(netPrice.times(quantitySafe)), totalProfit: round2(profit.times(quantitySafe)), requiredPrice: requiredPrice === null ? null : round2(requiredPrice), quantity: quantitySafe };
}

export type InvoiceLine = { description: string; quantity: number; unitPrice: number; discountPct: number };
export function calculateInvoice(lines: InvoiceLine[], discountType: "percent" | "fixed", invoiceDiscount: number, taxRate: number, fees: number, paid: number) {
  const details = lines.map((line) => {
    const gross = maxZeroDecimal(line.quantity).times(maxZeroDecimal(line.unitPrice));
    const total = maxZeroDecimal(gross.times(new Decimal(1).minus(clampDecimal(line.discountPct, 0, 100).div(100))));
    return { ...line, gross: round2(gross), total: round2(total) };
  });
  const subtotal = round2(sumBy(details, (line) => line.total));
  const rawDiscount = discountType === "percent" ? D(subtotal).times(clampDecimal(invoiceDiscount, 0, 100)).div(100) : maxZeroDecimal(invoiceDiscount);
  const discount = round2(rawDiscount.greaterThan(subtotal) ? subtotal : rawDiscount);
  const taxableBase = round2(maxZeroDecimal(D(subtotal).minus(discount)));
  const tax = round2(D(taxableBase).times(clampDecimal(taxRate, 0, 100)).div(100));
  const safeFees = round2(Math.max(0, fees));
  const total = round2(D(taxableBase).plus(tax).plus(safeFees));
  return { lines: details, subtotal, discount, taxableBase, tax, fees: safeFees, total, paid: round2(Math.max(0, paid)), balanceDue: round2(maxZeroDecimal(D(total).minus(Math.max(0, paid)))) };
}
