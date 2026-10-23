import { describe, expect, it } from "vitest";
import {
  budgetSummary,
  debtTotals,
  goalSummary,
  netWorthSummary,
  paycheckSummary,
  simulateDebt,
} from "@/lib/calc/money";
import {
  bookkeepingSummary,
  forecastCashFlow,
  inventorySummary,
  invoiceTotals,
  saleTotals,
  salesSummary,
} from "@/lib/calc/business";
import {
  bookingsOverlap,
  dailyTotals,
  findOverlaps,
  macroSplit,
  nightsBetween,
  propertySummary,
  recipeMacros,
  scaleFood,
  weddingSummary,
} from "@/lib/calc/life";
import {
  contentSummary,
  findDependencyCycles,
  habitStats,
  habitsOverview,
  isOverdue,
  projectProgress,
  wouldCreateCycle,
} from "@/lib/calc/work";
import { formatMoney, pct, round2 } from "@/lib/money";
import type {
  BusinessProduct,
  BusinessTransaction,
  ContentPost,
  Debt,
  GoalMovement,
  Habit,
  HabitCompletion,
  Holding,
  InventoryMovement,
  Invoice,
  MoneyBudget,
  MoneyCategory,
  MoneyTransaction,
  NetWorthItem,
  Paycheck,
  PaycheckAllocation,
  Payment,
  PropertyBooking,
  RecipeIngredient,
  Sale,
  SavingsGoal,
  Task,
  TaskDependency,
  ValuationSnapshot,
  WeddingExpense,
  WeddingGuest,
  WeddingPayment,
  WeddingTable,
  WeddingVendor,
} from "@/lib/types";

const base = { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };

/* ------------------------------------------------------------------ MONEY */

describe("annual budget", () => {
  const categories: MoneyCategory[] = [
    { ...base, id: "c-food", name: "Food", kind: "expense" },
    { ...base, id: "c-pay", name: "Salary", kind: "income" },
  ];
  const budgets: MoneyBudget[] = [{ ...base, id: "b1", month: "2026-01", categoryId: "c-food", amount: 1500 }];
  const transactions: MoneyTransaction[] = [
    { ...base, id: "t1", date: "2026-01-02", description: "Salary", amount: 5000, currency: "USD", type: "income", categoryId: "c-pay", status: "posted" },
    { ...base, id: "t2", date: "2026-01-05", description: "Groceries", amount: 1200, currency: "USD", type: "expense", categoryId: "c-food", status: "posted" },
    { ...base, id: "t3", date: "2026-01-06", description: "Pending", amount: 300, currency: "USD", type: "expense", categoryId: "c-food", status: "pending" },
    { ...base, id: "t4", date: "2026-01-07", description: "Move to savings", amount: 500, currency: "USD", type: "transfer", status: "posted" },
    { ...base, id: "t5", date: "2026-01-08", description: "Savings", amount: 200, currency: "USD", type: "savings", status: "posted" },
  ];

  const summary = budgetSummary({ transactions, categories, budgets, period: "2026-01", budgetMonth: "2026-01" });

  it("counts posted income and expenses only", () => {
    expect(summary.income).toBe(5000);
    expect(summary.expenses).toBe(1200);
    expect(summary.netCashFlow).toBe(3800);
  });

  it("excludes internal transfers and savings movements from both totals", () => {
    expect(summary.transfers).toBe(500);
    expect(summary.savingsTransfers).toBe(200);
    expect(summary.expenses).not.toContain(500);
  });

  it("computes the savings rate against income", () => {
    expect(summary.savingsRate).toBe(76);
  });

  it("computes budget remaining and category variance", () => {
    expect(summary.budgetAllocation).toBe(1500);
    expect(summary.budgetRemaining).toBe(300);
    const food = summary.byCategory.find((c) => c.categoryId === "c-food");
    expect(food?.variance).toBe(300);
    // Variance is expressed against the budget for the category (300 / 1500), not against
    // the amount actually spent — "20% under budget" is the reading a user expects.
    expect(food?.variancePct).toBe(20);
  });

  it("returns N/A rather than Infinity when there is no income", () => {
    const empty = budgetSummary({ transactions: [], categories, budgets: [], period: "2026-01" });
    expect(empty.savingsRate).toBeNull();
    expect(empty.avgMonthlySpending).toBeNull();
  });
});

describe("paycheck planner", () => {
  const paycheck: Paycheck = { ...base, id: "p1", date: "2026-01-01", expectedAmount: 3000, actualAmount: 3000, savingsAllocation: 100 };
  const allocations: PaycheckAllocation[] = [
    { ...base, id: "a1", paycheckId: "p1", label: "Rent", amount: 800, kind: "bill", paid: false },
    { ...base, id: "a2", paycheckId: "p1", label: "Phone", amount: 200, kind: "bill", paid: true },
    { ...base, id: "a3", paycheckId: "p1", label: "Groceries", amount: 400, kind: "spending" },
    { ...base, id: "a4", paycheckId: "p1", label: "Holiday", amount: 300, kind: "savings" },
  ];

  it("counts each bill once whether planned or paid", () => {
    const s = paycheckSummary(paycheck, allocations, { nextPayDate: "2026-01-11", today: "2026-01-01" });
    expect(s.available).toBe(1200); // 3000 - 800 - 200 - 400 - (300 + 100)
    expect(s.paidBills).toBe(200);
    expect(s.plannedBills).toBe(800);
  });

  it("subtracts additional uncounted spending and derives a daily allowance", () => {
    const s = paycheckSummary(paycheck, allocations, {
      nextPayDate: "2026-01-11",
      today: "2026-01-01",
      extraActualSpending: 200,
    });
    expect(s.remaining).toBe(1000);
    expect(s.daysUntilNextPaycheck).toBe(10);
    expect(s.dailyAllowance).toBe(100);
  });

  it("returns N/A for the allowance when payday is today", () => {
    const s = paycheckSummary(paycheck, allocations, { nextPayDate: "2026-01-01", today: "2026-01-01" });
    expect(s.dailyAllowance).toBeNull();
  });
});

describe("debt payoff", () => {
  it("amortises a single balance and reports interest", () => {
    const sim = simulateDebt(
      [{ id: "d1", name: "Card", balance: 1000, annualRate: 12, minimumPayment: 100 }],
      0,
      "snowball",
      new Date("2026-01-01"),
    );
    expect(sim.months).toBeGreaterThanOrEqual(10);
    expect(sim.months).toBeLessThanOrEqual(12);
    expect(sim.totalInterest).toBeGreaterThan(0);
    expect(sim.totalInterest).toBeLessThan(100);
    expect(sim.rows.at(-1)?.balance).toBe(0);
  });

  it("prefers avalanche when a higher-rate debt exists", () => {
    const debts = [
      { id: "a", name: "High rate", balance: 1000, annualRate: 24, minimumPayment: 50 },
      { id: "b", name: "Low rate", balance: 500, annualRate: 5, minimumPayment: 50 },
    ];
    const snowball = simulateDebt(debts, 100, "snowball");
    const avalanche = simulateDebt(debts, 100, "avalanche");
    expect(avalanche.totalInterest).toBeLessThanOrEqual(snowball.totalInterest);
  });

  it("detects a non-amortising plan instead of pretending it will finish", () => {
    const sim = simulateDebt(
      [{ id: "d", name: "Predatory", balance: 1000, annualRate: 24, minimumPayment: 5 }],
      0,
      "snowball",
    );
    expect(sim.nonAmortizing).toBe(true);
  });

  it("never reduces a balance below zero", () => {
    const sim = simulateDebt([{ id: "d", name: "Small", balance: 50, annualRate: 0, minimumPayment: 100 }], 0, "snowball");
    expect(sim.rows.every((r) => r.balance >= 0)).toBe(true);
    expect(sim.months).toBe(1);
  });

  it("summarises totals across debts", () => {
    const debts: Debt[] = [
      { ...base, id: "1", name: "A", openingPrincipal: 1000, annualRate: 10, minimumPayment: 50, extraPayment: 0, currency: "USD", frequency: "monthly" },
      { ...base, id: "2", name: "B", openingPrincipal: 2000, annualRate: 20, minimumPayment: 80, extraPayment: 0, currency: "USD", frequency: "monthly" },
    ];
    const totals = debtTotals(debts);
    expect(totals.balance).toBe(3000);
    expect(totals.minimums).toBe(130);
  });
});

describe("savings goals", () => {
  const goal: SavingsGoal = {
    ...base,
    id: "g1",
    name: "Emergency fund",
    targetAmount: 2600,
    targetDate: "2026-07-15",
    openingBalance: 1000,
    currency: "USD",
    kind: "emergency",
    monthlyEssentials: 800,
  };
  const movements: GoalMovement[] = [
    { ...base, id: "m1", goalId: "g1", date: "2026-01-05", amount: 500, kind: "contribution" },
    { ...base, id: "m2", goalId: "g1", date: "2026-01-20", amount: 200, kind: "withdrawal" },
  ];

  it("derives the balance from opening plus contributions minus withdrawals", () => {
    const s = goalSummary(goal, movements, new Date("2026-01-15"));
    expect(s.balance).toBe(1300);
    expect(s.remaining).toBe(1300);
    expect(s.progressPct).toBe(50);
  });

  it("computes the monthly amount required to hit the target date", () => {
    const s = goalSummary(goal, movements, new Date("2026-01-15"));
    expect(s.monthsLeft).toBe(6);
    expect(s.requiredMonthly).toBe(216.67);
  });

  it("reports months of cover for an emergency fund", () => {
    const s = goalSummary(goal, movements, new Date("2026-01-15"));
    expect(s.monthsOfCover).toBe(1.63);
  });

  it("flags an overdue target instead of silently rounding", () => {
    const s = goalSummary(goal, movements, new Date("2026-09-01"));
    expect(s.overdue).toBe(true);
    expect(s.requiredMonthly).toBeNull();
  });
});

describe("net worth", () => {
  const items: NetWorthItem[] = [
    { ...base, id: "a1", name: "Cash", kind: "asset", category: "Cash", value: 10000, currency: "USD", valuationDate: "2026-01-01" },
    { ...base, id: "l1", name: "Loan", kind: "liability", category: "Loan", value: 3000, currency: "USD", valuationDate: "2026-01-01" },
  ];
  const holdings: Holding[] = [
    { ...base, id: "h1", name: "Index fund", quantity: 10, unitPrice: 100, costBasis: 800, currency: "USD", valuationDate: "2026-01-01", priceSource: "manual" },
  ];
  const snapshots: ValuationSnapshot[] = [
    { ...base, id: "s1", date: "2025-12-01", totalAssets: 7000, totalLiabilities: 3000, currency: "USD" },
  ];

  it("includes holdings at market value and computes unrealised gain", () => {
    const s = netWorthSummary(items, holdings, snapshots);
    expect(s.assets).toBe(11000);
    expect(s.liabilities).toBe(3000);
    expect(s.netWorth).toBe(8000);
    expect(s.unrealizedGain).toBe(200);
    expect(s.unrealizedGainPct).toBe(25);
  });

  it("reports change against the previous snapshot", () => {
    const s = netWorthSummary(items, holdings, snapshots);
    expect(s.change).toBe(4000);
    expect(s.changePct).toBe(100);
  });

  it("returns N/A for change % when the previous snapshot is zero", () => {
    const s = netWorthSummary(items, holdings, [{ ...base, id: "s0", date: "2025-11-01", totalAssets: 0, totalLiabilities: 0, currency: "USD" }]);
    expect(s.changePct).toBeNull();
  });
});

/* --------------------------------------------------------------- BUSINESS */

describe("bookkeeping (cash basis)", () => {
  const txs: BusinessTransaction[] = [
    { ...base, id: "1", date: "2026-01-03", description: "Client payment", amount: 4000, type: "revenue" },
    { ...base, id: "2", date: "2026-01-04", description: "Rent", amount: 1000, type: "expense" },
    { ...base, id: "3", date: "2026-01-05", description: "Owner top-up", amount: 500, type: "owner_contribution" },
    { ...base, id: "4", date: "2026-01-06", description: "Owner draw", amount: 300, type: "owner_draw" },
    { ...base, id: "5", date: "2026-01-07", description: "Loan", amount: 2000, type: "loan_proceeds" },
  ];
  const s = bookkeepingSummary(txs, "2026-01");

  it("separates revenue from owner and loan movements", () => {
    expect(s.cashRevenue).toBe(4000);
    expect(s.operatingExpenses).toBe(1000);
    expect(s.ownerContributions).toBe(500);
    expect(s.ownerDraws).toBe(300);
    expect(s.loanProceeds).toBe(2000);
  });

  it("computes operating surplus and expense ratio", () => {
    expect(s.operatingSurplus).toBe(3000);
    expect(s.expenseRatio).toBe(25);
    expect(s.cashMovement).toBe(5200); // (4000+500+2000) - (1000+300)
  });
});

describe("inventory valuation", () => {
  const product: BusinessProduct = {
    ...base,
    id: "p1",
    name: "Mug",
    sku: "MUG-1",
    unit: "unit",
    salePrice: 20,
    unitCost: 10,
    reorderThreshold: 20,
    quantity: 0,
  };
  const movements: InventoryMovement[] = [
    { ...base, id: "m1", productId: "p1", date: "2026-01-01", type: "receipt", quantity: 100, unitCost: 10 },
    { ...base, id: "m2", productId: "p1", date: "2026-01-05", type: "receipt", quantity: 50, unitCost: 16 },
    { ...base, id: "m3", productId: "p1", date: "2026-01-10", type: "dispatch", quantity: 30 },
  ];

  it("re-averages cost on receipts and leaves it unchanged on issues", () => {
    const summary = inventorySummary([product], movements);
    const v = summary.items[0].valuation;
    expect(v.quantity).toBe(120);
    expect(v.averageCost).toBe(12); // (100*10 + 50*16) / 150
    expect(v.inventoryValue).toBe(1440);
    expect(v.retailValue).toBe(2400);
  });

  it("computes gross profit and margin per unit", () => {
    const v = inventorySummary([product], movements).items[0].valuation;
    expect(v.grossProfitPerUnit).toBe(8);
    expect(v.grossMarginPct).toBe(40);
  });

  it("flags low stock at or below the reorder threshold", () => {
    const v = inventorySummary([product], movements).items[0].valuation;
    expect(v.lowStock).toBe(false);
    const afterDispatch = inventorySummary([product], [
      ...movements,
      { ...base, id: "m4", productId: "p1", date: "2026-01-11", type: "dispatch", quantity: 100 },
    ]).items[0].valuation;
    expect(afterDispatch.quantity).toBe(20);
    expect(afterDispatch.lowStock).toBe(true);
  });

  it("never lets stock go negative", () => {
    const v = inventorySummary([product], [
      { ...base, id: "m9", productId: "p1", date: "2026-01-01", type: "dispatch", quantity: 500 },
    ]).items[0].valuation;
    expect(v.quantity).toBe(0);
  });
});

describe("sales", () => {
  const sale: Sale = {
    ...base,
    id: "s1",
    date: "2026-01-10",
    description: "Two mugs",
    quantity: 2,
    unitPrice: 100,
    discount: 20,
    returned: 0,
    taxRate: 10,
    status: "paid",
    currency: "USD",
  };

  it("nets discounts and returns before tax", () => {
    const t = saleTotals(sale);
    expect(t.gross).toBe(200);
    expect(t.net).toBe(180);
    expect(t.tax).toBe(18);
    expect(t.total).toBe(198);
  });

  it("computes average order value and target progress", () => {
    const s = salesSummary([sale], [{ ...base, id: "tg", period: "2026-01", target: 360, currency: "USD" }], { period: "2026-01" });
    expect(s.net).toBe(180);
    expect(s.averageOrderValue).toBe(180);
    expect(s.targetProgress).toBe(50);
  });

  it("returns N/A growth when there is no prior period revenue", () => {
    const s = salesSummary([sale], [], { period: "2026-01", priorPeriod: "2025-12" });
    expect(s.growth).toBeNull();
  });
});

describe("invoicing", () => {
  const invoice: Invoice = {
    ...base,
    id: "i1",
    number: "INV-0001",
    issueDate: "2026-01-01",
    dueDate: "2026-01-31",
    status: "sent",
    taxRate: 10,
    discount: 100,
    currency: "USD",
    lines: [
      { id: "l1", description: "Design", quantity: 2, unitPrice: 500 },
      { id: "l2", description: "Hosting", quantity: 1, unitPrice: 0.1 },
    ],
  };
  const payments: Payment[] = [{ ...base, id: "pay1", invoiceId: "i1", date: "2026-01-15", amount: 400, method: "bank" }];

  it("applies discount before tax with decimal-safe rounding", () => {
    const t = invoiceTotals(invoice, [], "2026-01-20");
    expect(t.subtotal).toBe(1000.1);
    expect(t.discount).toBe(100);
    expect(t.taxable).toBe(900.1);
    expect(t.tax).toBe(90.01);
    expect(t.total).toBe(990.11);
  });

  it("supports partial payments and derives the status", () => {
    const t = invoiceTotals(invoice, payments, "2026-01-20");
    expect(t.paid).toBe(400);
    expect(t.balanceDue).toBe(590.11);
    expect(t.status).toBe("partial");
  });

  it("marks an invoice overdue only after the due date and while a balance remains", () => {
    expect(invoiceTotals(invoice, payments, "2026-01-20").isOverdue).toBe(false);
    const overdue = invoiceTotals(invoice, payments, "2026-02-10");
    expect(overdue.isOverdue).toBe(true);
    expect(overdue.overdueDays).toBe(10);
  });

  it("treats a fully paid invoice as paid", () => {
    const t = invoiceTotals(invoice, [{ ...base, id: "pay2", invoiceId: "i1", date: "2026-01-16", amount: 990.11, method: "bank" }], "2026-01-20");
    expect(t.balanceDue).toBe(0);
    expect(t.status).toBe("paid");
  });
});

describe("cash flow forecast", () => {
  it("projects closing cash and ignores cancelled certainty weighting for committed items", () => {
    const result = forecastCashFlow(
      [
        { ...base, id: "f1", label: "Client", kind: "inflow", amount: 500, week: 0, certainty: "committed" },
        { ...base, id: "f2", label: "Rent", kind: "outflow", amount: 300, week: 0, certainty: "committed" },
      ],
      { openingCash: 1000, minimumCash: 500 },
      { weeks: 2 },
    );
    expect(result.weeks[0].closing).toBe(1200);
    expect(result.closingCash).toBe(1200);
    expect(result.shortfall).toBe(0);
    expect(result.netFlow).toBe(200);
  });

  it("reports a shortfall when closing cash drops below the buffer", () => {
    const result = forecastCashFlow(
      [{ ...base, id: "f3", label: "Payroll", kind: "outflow", amount: 900, week: 0, certainty: "committed" }],
      { openingCash: 1000, minimumCash: 500 },
      { weeks: 1 },
    );
    expect(result.weeks[0].closing).toBe(100);
    expect(result.shortfall).toBe(400);
  });

  it("weights uncertain inflows differently by scenario", () => {
    const items = [{ ...base, id: "f4", label: "Maybe", kind: "inflow" as const, amount: 1000, week: 0, certainty: "possible" as const }];
    const weighted = forecastCashFlow(items, { openingCash: 0, minimumCash: 0 }, { weeks: 1, mode: "base" });
    const optimistic = forecastCashFlow(items, { openingCash: 0, minimumCash: 0 }, { weeks: 1, mode: "optimistic" });
    expect(weighted.weeks[0].inflows).toBe(600);
    expect(optimistic.weeks[0].inflows).toBe(1000);
  });
});

/* ------------------------------------------------------------------- LIFE */

describe("wedding planner", () => {
  const guests: WeddingGuest[] = [
    { ...base, id: "g1", name: "Ada", household: "Ada", seats: 2, rsvp: "accepted", tableId: "t1" },
    { ...base, id: "g2", name: "Bola", household: "Bola", seats: 1, rsvp: "accepted", tableId: "t1" },
    { ...base, id: "g3", name: "Chidi", household: "Chidi", seats: 2, rsvp: "invited" },
  ];
  const tables: WeddingTable[] = [{ ...base, id: "t1", name: "Table 1", capacity: 2 }];
  const expenses: WeddingExpense[] = [{ ...base, id: "e1", category: "Venue", label: "Hall", committed: 5000, actual: 4500, paid: 2000 }];
  const vendors: WeddingVendor[] = [{ ...base, id: "v1", name: "Caterer", category: "Catering", contractedAmount: 3000 }];
  const payments: WeddingPayment[] = [{ ...base, id: "wp1", vendorId: "v1", date: "2026-01-10", amount: 1000 }];

  const s = weddingSummary({
    eventDate: "2026-06-01",
    totalBudget: 10000,
    expenses,
    guests,
    vendors,
    payments,
    tables,
    today: "2026-01-01",
  });

  it("counts seats rather than guest rows", () => {
    expect(s.guestSeatsInvited).toBe(5);
    expect(s.guestSeatsAccepted).toBe(3);
    expect(s.acceptanceRate).toBe(60);
  });

  it("separates committed from actual and paid", () => {
    expect(s.committed).toBe(5000);
    expect(s.actualExpenses).toBe(4500);
    expect(s.budgetRemaining).toBe(5500);
    expect(s.committedRemaining).toBe(5000);
  });

  it("computes vendor outstanding balances", () => {
    expect(s.vendorOutstanding).toBe(2000);
  });

  it("warns when a table exceeds capacity", () => {
    expect(s.seatingWarnings.length).toBeGreaterThan(0);
    expect(s.seatingWarnings[0]).toContain("over capacity");
  });

  it("computes the countdown", () => {
    expect(s.daysUntil).toBe(151);
  });
});

describe("rental property", () => {
  const bookings: PropertyBooking[] = [
    { ...base, id: "b1", propertyId: "p1", unitId: "u1", guest: "A", checkIn: "2026-01-01", checkOut: "2026-01-05", nights: 4, accommodation: 400, platformFee: 40, cleaningFee: 20, status: "stayed", paid: true, channel: "airbnb" },
    { ...base, id: "b2", propertyId: "p1", unitId: "u1", guest: "B", checkIn: "2026-01-04", checkOut: "2026-01-06", nights: 2, accommodation: 200, platformFee: 20, cleaningFee: 20, status: "booked", paid: false, channel: "direct" },
  ];

  it("computes nights between dates", () => {
    expect(nightsBetween("2026-01-01", "2026-01-05")).toBe(4);
    expect(nightsBetween("2026-01-05", "2026-01-01")).toBe(0);
  });

  it("detects overlapping stays in the same unit", () => {
    expect(bookingsOverlap(bookings[0], bookings[1])).toBe(true);
    expect(findOverlaps(bookings)).toHaveLength(1);
  });

  it("does not flag overlaps across different units", () => {
    const other = { ...bookings[1], id: "b3", unitId: "u2" };
    expect(bookingsOverlap(bookings[0], other)).toBe(false);
  });

  it("computes occupancy, ADR and RevPAN", () => {
    const s = propertySummary({ bookings, expenses: [], maintenance: [], availableNights: 10 });
    expect(s.accommodationRevenue).toBe(600);
    expect(s.occupiedNights).toBe(6);
    expect(s.occupancyRate).toBe(60);
    expect(s.adr).toBe(100);
    expect(s.revPan).toBe(60);
  });

  it("subtracts fees, cleaning and maintenance from net operating income", () => {
    const s = propertySummary({
      bookings,
      expenses: [{ ...base, id: "x1", propertyId: "p1", date: "2026-01-10", category: "Utilities", amount: 100 }],
      maintenance: [{ ...base, id: "m1", propertyId: "p1", date: "2026-01-11", title: "Fix tap", cost: 50, done: true }],
      availableNights: 10,
    });
    expect(s.operatingExpenses).toBe(40 + 20 + 20 + 20 + 100 + 50);
    expect(s.netOperatingIncome).toBe(600 + 40 - 250);
  });
});

describe("nutrition", () => {
  it("scales per-100g values to the consumed weight", () => {
    const m = scaleFood({ kcal: 200, protein: 10, carbs: 20, fat: 5, fiber: 2 }, 150);
    expect(m.kcal).toBe(300);
    expect(m.protein).toBe(15);
    expect(m.carbs).toBe(30);
    expect(m.fat).toBe(7.5);
    expect(m.fiber).toBe(3);
  });

  it("totals a day of logs", () => {
    const totals = dailyTotals(
      [
        { ...base, id: "l1", date: "2026-01-01", meal: "breakfast", name: "Oats", grams: 100, kcal: 300, protein: 10, carbs: 50, fat: 6 },
        { ...base, id: "l2", date: "2026-01-01", meal: "lunch", name: "Rice", grams: 200, kcal: 500, protein: 8, carbs: 100, fat: 2 },
        { ...base, id: "l3", date: "2026-01-02", meal: "lunch", name: "Other day", grams: 100, kcal: 999, protein: 0, carbs: 0, fat: 0 },
      ],
      "2026-01-01",
    );
    expect(totals.kcal).toBe(800);
    expect(totals.protein).toBe(18);
    expect(totals.entries).toBe(2);
  });

  it("divides recipe totals by servings", () => {
    const ingredients: RecipeIngredient[] = [
      { id: "i1", name: "A", grams: 100, kcal: 400, protein: 20, carbs: 40, fat: 10 },
      { id: "i2", name: "B", grams: 50, kcal: 200, protein: 10, carbs: 10, fat: 5 },
    ];
    const result = recipeMacros({ ...base, id: "r1", name: "Stew", servings: 2 }, ingredients);
    expect(result.total.kcal).toBe(600);
    expect(result.perServing.kcal).toBe(300);
    expect(result.perServing.protein).toBe(15);
  });

  it("never divides by zero servings", () => {
    const result = recipeMacros({ ...base, id: "r2", name: "Zero", servings: 0 }, []);
    expect(result.servings).toBe(1);
    expect(result.perServing.kcal).toBe(0);
  });

  it("computes a macro energy split", () => {
    const split = macroSplit({ kcal: 0, protein: 25, carbs: 25, fat: 0, fiber: 0 });
    expect(split.protein).toBe(50);
    expect(split.carbs).toBe(50);
    expect(split.fat).toBe(0);
  });
});

/* ------------------------------------------------------------------- WORK */

describe("projects", () => {
  const tasks: Task[] = [
    { ...base, id: "t1", projectId: "p1", title: "A", status: "done", priority: "low", order: 0, dueDate: "2026-01-01" },
    { ...base, id: "t2", projectId: "p1", title: "B", status: "todo", priority: "high", order: 1, dueDate: "2025-12-31" },
    { ...base, id: "t3", projectId: "p1", title: "C", status: "in_progress", priority: "medium", order: 2 },
    { ...base, id: "t4", projectId: "p1", title: "D", status: "todo", priority: "medium", order: 3 },
  ];

  it("computes completion percentage and remaining tasks", () => {
    const s = projectProgress(tasks, "2026-01-05");
    expect(s.completionPct).toBe(25);
    expect(s.remaining).toBe(3);
    expect(s.inProgress).toBe(1);
  });

  it("counts overdue tasks only when not complete", () => {
    expect(projectProgress(tasks, "2026-01-05").overdue).toBe(1);
    expect(isOverdue(tasks[0], "2026-01-05")).toBe(false);
    expect(isOverdue(tasks[1], "2026-01-05")).toBe(true);
  });

  it("returns N/A completion for an empty project", () => {
    expect(projectProgress([]).completionPct).toBeNull();
  });

  it("detects circular dependencies", () => {
    const deps: TaskDependency[] = [
      { ...base, id: "d1", taskId: "t1", dependsOnTaskId: "t2" },
      { ...base, id: "d2", taskId: "t2", dependsOnTaskId: "t1" },
    ];
    expect(findDependencyCycles(deps).length).toBeGreaterThan(0);
    expect(wouldCreateCycle(deps, "t1", "t2")).toBe(true);
    expect(wouldCreateCycle([], "t1", "t1")).toBe(true);
  });

  it("accepts an acyclic dependency", () => {
    const deps: TaskDependency[] = [{ ...base, id: "d1", taskId: "t2", dependsOnTaskId: "t1" }];
    expect(findDependencyCycles(deps)).toHaveLength(0);
    expect(wouldCreateCycle(deps, "t3", "t2")).toBe(false);
  });
});

describe("habits", () => {
  const mondayHabit: Habit = {
    ...base,
    id: "h1",
    name: "Gym",
    days: [1],
    frequency: "custom",
    startDate: "2026-01-01",
  };
  const completions: HabitCompletion[] = [
    { ...base, id: "c1", habitId: "h1", date: "2026-01-05" },
    { ...base, id: "c2", habitId: "h1", date: "2026-01-12" },
  ];

  it("does not break a streak on unscheduled days", () => {
    const s = habitStats(mondayHabit, completions, "2026-01-13");
    expect(s.streak).toBe(2);
  });

  it("breaks the streak when a scheduled day is missed", () => {
    const s = habitStats(mondayHabit, completions, "2026-01-20");
    expect(s.streak).toBe(0);
  });

  it("counts expected occurrences from the schedule only", () => {
    const s = habitStats(mondayHabit, completions, "2026-01-13");
    expect(s.expected).toBe(2);
    expect(s.completionRate).toBe(100);
  });

  it("summarises today's scheduled habits", () => {
    const overview = habitsOverview([mondayHabit], completions, "2026-01-12");
    expect(overview.scheduledToday).toBe(1);
    expect(overview.doneToday).toBe(1);
    expect(overview.todayRate).toBe(100);
  });
});

describe("content planner", () => {
  const posts: ContentPost[] = [
    { ...base, id: "c1", title: "Launch", platform: "instagram", contentType: "post", status: "published", publishedDate: "2026-01-05", reach: 1000, engagements: 50 },
    { ...base, id: "c2", title: "Teaser", platform: "linkedin", contentType: "post", status: "scheduled", scheduledDate: "2026-01-20" },
    { ...base, id: "c3", title: "Idea", platform: "x", contentType: "post", status: "idea" },
  ];

  it("counts scheduled and published posts separately", () => {
    const s = contentSummary(posts, "2026-01");
    expect(s.scheduled).toBe(1);
    expect(s.published).toBe(1);
    expect(s.ideas).toBe(1);
  });

  it("computes publishing rate against planned posts only", () => {
    const s = contentSummary(posts, "2026-01");
    expect(s.publishingRate).toBe(50);
  });

  it("computes engagement rate from manually entered metrics", () => {
    const s = contentSummary(posts, "2026-01");
    expect(s.engagementRate).toBe(5);
  });

  it("returns N/A engagement when reach is zero", () => {
    const s = contentSummary([{ ...posts[0], reach: 0 }], "2026-01");
    expect(s.engagementRate).toBeNull();
  });

  it("flags scheduled posts whose date has passed without confirmation", () => {
    const s = contentSummary(
      [{ ...posts[1], scheduledDate: "2020-01-01" }],
      "2020-01",
    );
    expect(s.awaitingConfirmation).toHaveLength(1);
  });
});

/* ---------------------------------------------------------------- PLATFORM */

describe("money primitives", () => {
  it("avoids floating point drift", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
  });

  it("returns null rather than Infinity for zero denominators", () => {
    expect(pct(10, 0)).toBeNull();
  });

  it("formats currency with the requested code", () => {
    expect(formatMoney(1234.5, { currency: "USD" })).toContain("1,234.50");
  });
});
