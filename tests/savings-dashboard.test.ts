import { describe, expect, it } from "vitest";
import { projectedCompletionDate, savingsBalanceTrend, savingsGoalRows, savingsMovementMonths } from "@/lib/reporting/savings-dashboard";
import type { GoalMovement, SavingsGoal } from "@/lib/types";

const goal = (patch: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: "g1", name: "Emergency", targetAmount: 1200, openingBalance: 200, currency: "USD", kind: "emergency",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  ...patch,
});
const movement = (patch: Partial<GoalMovement> = {}): GoalMovement => ({
  id: "m1", goalId: "g1", date: "2026-02-01", amount: 100, kind: "contribution",
  createdAt: "2026-02-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z",
  ...patch,
});

describe("savings dashboard calculations", () => {
  it("adds opening funds and contributions, subtracts withdrawals, and clamps remaining at zero", () => {
    const rows = savingsGoalRows([goal()], [movement(), movement({ id: "m2", kind: "withdrawal", amount: 50 })], "2026-03-01");
    expect(rows[0]).toMatchObject({ balance: 250, target: 1200, remaining: 950, percent: 20.83 });
  });

  it("shows overfunding truth while remaining and donut progress can be capped separately", () => {
    expect(savingsGoalRows([goal({ openingBalance: 1500 })], [], "2026-03-01")[0]).toMatchObject({ balance: 1500, remaining: 0, percent: 125, status: "Goal Complete" });
    expect(savingsGoalRows([goal({ targetAmount: 0 })], [], "2026-03-01")[0].percent).toBeNull();
  });

  it("does not claim schedule status without both a start date and target date", () => {
    expect(savingsGoalRows([goal({ targetDate: "2026-12-01" })], [], "2026-03-01")[0].status).toBe("Insufficient Data");
    expect(savingsGoalRows([goal({ targetDate: undefined })], [], "2026-03-01")[0].status).toBe("No Target Date");
  });

  it("compares progress against the entered linear trajectory", () => {
    const planned = goal({ startDate: "2026-01-01", targetDate: "2026-07-01" });
    expect(savingsGoalRows([planned], [], "2026-04-01")[0].status).toBe("Behind Schedule");
    expect(savingsGoalRows([planned], [movement({ amount: 700 })], "2026-04-01")[0].status).toBe("Ahead of Schedule");
  });

  it("calculates monthly contribution needed with optional interest assumption", () => {
    const noInterest = savingsGoalRows([goal({ openingBalance: 0, targetDate: "2026-07-01" })], [], "2026-03-01")[0];
    const withInterest = savingsGoalRows([goal({ openingBalance: 0, targetDate: "2026-07-01", annualInterestRate: 6 })], [], "2026-03-01")[0];
    expect(noInterest.requiredMonthly).toBe(300);
    expect(withInterest.requiredMonthly).toBeLessThan(300);
  });

  it("projects completion only when an explicit contribution plan reaches the goal", () => {
    expect(projectedCompletionDate(goal({ targetAmount: 600, monthlyContribution: 100 }), 200, "2026-01-15")).toBe("2026-05-15");
    expect(projectedCompletionDate(goal({ monthlyContribution: 0 }), 200, "2026-01-15")).toBeNull();
  });

  it("clamps projected monthly dates at short month ends and ignores invalid negative records", () => {
    expect(projectedCompletionDate(goal({ targetAmount: 300, monthlyContribution: 100 }), 200, "2026-01-31")).toBe("2026-02-28");
    expect(savingsGoalRows([goal({ openingBalance: -50 })], [movement({ amount: -100 })], "2026-03-01")[0].balance).toBe(0);
  });

  it("aggregates only real dated movements and keeps withdrawals separate", () => {
    const history = savingsMovementMonths([movement(), movement({ id: "m2", kind: "withdrawal", amount: 25 })], 3, "2026-03-01", "g1");
    expect(history.at(-2)).toMatchObject({ contributions: 100, withdrawals: 25, net: 75 });
  });

  it("carries older movement balances into a filtered trend and does not invent a line without dated activity", () => {
    const movements = [movement({ date: "2025-12-01", amount: 75 }), movement({ id: "m2", date: "2026-03-01", amount: 25 })];
    expect(savingsBalanceTrend([goal()], movements, 3, "2026-03-15", "g1").at(-1)).toMatchObject({ balance: 300 });
    expect(savingsBalanceTrend([goal()], [], 12, "2026-03-15", "g1")).toEqual([]);
  });
});

