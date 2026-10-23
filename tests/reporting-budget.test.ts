import { describe, expect, it } from "vitest";
import {
  monthlyComparisonData,
  categorySlices,
  annualBudgetVsActual,
  annualBudgetAllocation,
  budgetUtilisation,
  topExpenseCategories,
  cashFlowTrend,
  budgetReportCSV,
} from "@/lib/reporting/budget";
import { budgetSummary } from "@/lib/calc/money";
import type { MoneyTransaction, MoneyCategory, MoneyBudget } from "@/lib/types";
import type { CategorySpend } from "@/lib/calc/money";

/* Minimal records — the reporting selectors only read the fields listed below, so we build just
 * those and cast. This keeps the fixtures readable and focused on the transformation under test. */
type Tx = Pick<MoneyTransaction, "id" | "date" | "amount" | "type" | "status" | "categoryId"> & {
  deleted?: 0 | 1;
};
function tx(p: Partial<Tx> & Pick<Tx, "id" | "date" | "amount" | "type">): MoneyTransaction {
  return { status: "posted", deleted: 0, categoryId: "uncategorized", ...p } as unknown as MoneyTransaction;
}

const categories: MoneyCategory[] = [
  { id: "housing", name: "Housing", kind: "expense" },
  { id: "food", name: "Food", kind: "expense" },
  { id: "small", name: "Misc", kind: "expense" },
  { id: "salary", name: "Salary", kind: "income" },
] as MoneyCategory[];

const budgets: MoneyBudget[] = [
  { id: "b1", month: "2026-01", categoryId: "housing", amount: 1000 },
  { id: "b2", month: "2026-02", categoryId: "housing", amount: 1000 },
  { id: "b3", month: "2026-03", categoryId: "housing", amount: 1000 },
  { id: "b4", month: "2026-04", categoryId: "housing", amount: 1000 },
  { id: "b5", month: "2026-05", categoryId: "housing", amount: 1000 },
  { id: "b6", month: "2026-06", categoryId: "housing", amount: 1000 },
  { id: "b7", month: "2026-07", categoryId: "housing", amount: 1000 },
  { id: "b8", month: "2026-08", categoryId: "housing", amount: 1000 },
  { id: "b9", month: "2026-09", categoryId: "housing", amount: 1000 },
  { id: "b10", month: "2026-10", categoryId: "housing", amount: 1000 },
  { id: "b11", month: "2026-11", categoryId: "housing", amount: 1000 },
  { id: "b12", month: "2026-12", categoryId: "housing", amount: 1000 },
  { id: "bf", month: "2026-01", categoryId: "food", amount: 400 },
] as MoneyBudget[];

const transactions: MoneyTransaction[] = [
  tx({ id: "t1", date: "2026-01-15", amount: 3000, type: "income", categoryId: "salary" }),
  tx({ id: "t2", date: "2026-01-10", amount: 900, type: "expense", categoryId: "housing" }),
  tx({ id: "t3", date: "2026-01-12", amount: 350, type: "expense", categoryId: "food" }),
  tx({ id: "t4", date: "2026-02-10", amount: 1100, type: "expense", categoryId: "housing" }),
  tx({ id: "t5", date: "2026-03-10", amount: 12, type: "expense", categoryId: "small" }),
];

function summary(year = "2026", currency = "USD") {
  return budgetSummary({ transactions, categories, budgets, period: year, currency });
}

describe("monthlyComparisonData", () => {
  it("returns all 12 months for a year period", () => {
    const data = monthlyComparisonData(summary());
    expect(data).toHaveLength(12);
    expect(data[0].month).toBe("2026-01");
    expect(data[11].month).toBe("2026-12");
  });

  it("aggregates income and expenses per month", () => {
    const data = monthlyComparisonData(summary());
    const jan = data.find((m) => m.month === "2026-01")!;
    expect(jan.income).toBe(3000);
    expect(jan.expenses).toBe(1250); // 900 housing + 350 food
    // Unspent months must be genuine zeros, not fabricated positive values.
    const apr = data.find((m) => m.month === "2026-04")!;
    expect(apr.income).toBe(0);
    expect(apr.expenses).toBe(0);
  });
});

describe("categorySlices (donut)", () => {
  it("shows every category when there are few of them", () => {
    const names = categorySlices(summary().byCategory).map((s) => s.name);
    expect(names).toContain("Housing");
    expect(names).toContain("Food");
    expect(names).toContain("Misc"); // only 3 categories, so nothing is merged
  });

  it("merges the smallest categories into Other once the cap is exceeded, without losing totals", () => {
    const many: CategorySpend[] = Array.from({ length: 10 }, (_, i) => ({
      categoryId: `c${i}`,
      name: `Cat${i}`,
      kind: "expense",
      actual: i === 0 ? 1000 : 5,
      budget: 0,
      variance: 0,
      variancePct: 0,
    }));
    const slices = categorySlices(many, { maxSlices: 7 });
    const names = slices.map((s) => s.name);
    expect(names).toContain("Other");
    expect(names).not.toContain("Cat9");
    const total = slices.reduce((s, c) => s + c.value, 0);
    expect(total).toBeCloseTo(1000 + 9 * 5, 2); // merge never drops money
  });

  it("returns an empty array when there is no spending", () => {
    const empty = budgetSummary({ transactions: [], categories, budgets, period: "2026" });
    expect(categorySlices(empty.byCategory)).toEqual([]);
  });
});

describe("annualBudgetVsActual", () => {
  it("sums monthly budgets across the year and matches actual spend", () => {
    const rows = annualBudgetVsActual({ transactions, categories, budgets, year: "2026" });
    const housing = rows.find((r) => r.category === "Housing")!;
    expect(housing.budget).toBe(12000); // 12 x 1000
    expect(housing.actual).toBe(900 + 1100); // Jan + Feb only
    expect(housing.actual).toBeLessThan(housing.budget); // under budget
  });

  it("flags overspend via the actual vs budget comparison", () => {
    const over = annualBudgetVsActual({
      transactions: [tx({ id: "x", date: "2026-01-05", amount: 1500, type: "expense", categoryId: "food" })],
      categories,
      budgets,
      year: "2026",
    });
    const food = over.find((r) => r.category === "Food")!;
    expect(food.budget).toBe(400); // only January food budget exists
    expect(food.actual).toBe(1500);
    expect(food.actual).toBeGreaterThan(food.budget);
  });

  it("annualBudgetAllocation matches the summed monthly budgets", () => {
    expect(annualBudgetAllocation(budgets, "2026")).toBe(12400); // 12000 + 400
  });
});

describe("budgetUtilisation + topExpenseCategories", () => {
  it("uses the single-month budget as the target (annual views should prefer annualBudgetVsActual)", () => {
    const util = budgetUtilisation(summary().byCategory);
    const housing = util.find((u) => u.label === "Housing")!;
    // The summary keeps only one month's budget as `budget`, so the year's actual (2000) exceeds it.
    expect(housing.target).toBe(1000);
    expect(housing.over).toBe(true);
  });

  it("ranks categories by actual spend descending and caps at max", () => {
    const top = topExpenseCategories(summary().byCategory, 2);
    expect(top).toHaveLength(2);
    expect(top[0].label).toBe("Housing");
  });
});

describe("cashFlowTrend", () => {
  it("produces a labelled monthly net series", () => {
    const trend = cashFlowTrend(summary());
    expect(trend).toHaveLength(12);
    const jan = trend.find((t) => t.month === "2026-01")!;
    expect(jan.net).toBe(3000 - 1250);
    expect(jan.label).toBe("Jan");
  });
});

describe("budgetReportCSV", () => {
  it("includes monthly rows and category rows, no fabricated lines", () => {
    const csv = budgetReportCSV(summary(), { periodLabel: "2026", currency: "USD" });
    expect(csv).toContain("Monthly,Income,Expenses,Net");
    expect(csv).toContain("2026-01,3000,1250");
    expect(csv).toContain("Category,Kind,Actual,Budget,Variance");
  });
});
