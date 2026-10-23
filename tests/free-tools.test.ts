import { describe, expect, it } from "vitest";
import { calculateBudget, calculateDebt, calculateInvoice, calculateProfit, calculateRental, calculateSavings } from "@/lib/free-tools";

describe("GridHub free calculator calculations", () => {
  it("totals income, expenses, category shares and handles no expenses", () => {
    const result = calculateBudget([3000, 500], [{ name: "Rent", amount: 1200 }, { name: "Food", amount: 300 }]);
    expect(result.income).toBe(3500);
    expect(result.expenses).toBe(1500);
    expect(result.remaining).toBe(2000);
    expect(result.categories[0].share).toBe(80);
    expect(calculateBudget([0], [{ name: "None", amount: 0 }]).categories[0].share).toBe(0);
  });

  it("projects debt with minimums and compares payoff strategies", () => {
    const result = calculateDebt([
      { id: "a", name: "Small high rate", balance: 500, annualRate: 24, minimumPayment: 30 },
      { id: "b", name: "Large low rate", balance: 2500, annualRate: 8, minimumPayment: 80 },
    ], 100, new Date("2026-01-01T00:00:00Z"));
    expect(result.initialDebt).toBe(3000);
    expect(result.payoffAchievable).toBe(true);
    expect(result.avalanche.totalPaid).toBeGreaterThan(3000);
    expect(result.avalanche.perDebt.find((d) => d.name === "Large low rate")?.payoffMonth).toBeGreaterThan(0);
    expect(calculateDebt([{ id: "z", name: "No payment", balance: 1000, annualRate: 24, minimumPayment: 0 }], 0).payoffAchievable).toBe(false);
    expect(calculateDebt([{ id: "z", name: "Zero APR", balance: 100, annualRate: 0, minimumPayment: 20 }], 0).avalanche.totalInterest).toBe(0);
  });

  it("calculates rental NOI separately from debt service with zero-interest financing", () => {
    const result = calculateRental({ price: 100000, downPayment: 20000, closingCosts: 1000, repairs: 0, rent: 1200, otherIncome: 0, vacancy: 0, expenses: [{ name: "Tax", amount: 1200, period: "annual" }, { name: "Repairs", amount: 100, period: "monthly" }], rate: 0, termYears: 20 });
    expect(result.principal).toBe(80000);
    expect(result.payment).toBeCloseTo(333.33, 2);
    expect(result.noi).toBe(1000);
    expect(result.cashFlow).toBeCloseTo(666.67, 2);
    expect(result.capRate).toBe(12);
    expect(calculateRental({ price: 0, downPayment: 0, closingCosts: 0, repairs: 0, rent: 0, otherIncome: 0, vacancy: 0, expenses: [], rate: 0, termYears: 1 }).capRate).toBeNull();
  });

  it("calculates monthly savings and handles achieved goals and positive interest", () => {
    const noInterest = calculateSavings(1200, 200, 10);
    expect(noInterest.contribution).toBe(100);
    expect(noInterest.progress).toBeCloseTo(16.67, 2);
    expect(calculateSavings(100, 120, 0).contribution).toBe(0);
    const withInterest = calculateSavings(1200, 0, 12, 12);
    expect(withInterest.contribution).toBeLessThan(100);
    expect(withInterest.chart.at(-1)?.balance).toBeGreaterThanOrEqual(1200);
  });

  it("keeps margin distinct from markup and rejects a 100% target margin", () => {
    const result = calculateProfit(50, 30, 10, 0, 40);
    expect(result.unitProfit).toBe(20);
    expect(result.margin).toBe(40);
    expect(result.markup).toBeCloseTo(66.67, 2);
    expect(result.requiredPrice).toBe(50);
    expect(calculateProfit(0, 10, 1, 0, 100).requiredPrice).toBeNull();
    expect(calculateProfit(10, 20, 2).totalProfit).toBe(-20);
  });

  it("applies line discounts before invoice discount and taxes the reduced subtotal", () => {
    const result = calculateInvoice([
      { description: "A", quantity: 2, unitPrice: 10, discountPct: 10 },
      { description: "B", quantity: 1, unitPrice: 5, discountPct: 0 },
    ], "percent", 10, 10, 2, 5);
    expect(result.subtotal).toBe(23);
    expect(result.discount).toBe(2.3);
    expect(result.taxableBase).toBe(20.7);
    expect(result.tax).toBe(2.07);
    expect(result.total).toBe(24.77);
    expect(result.balanceDue).toBe(19.77);
    expect(calculateInvoice([], "fixed", 50, 100, 0, 0).total).toBe(0);
  });
});
