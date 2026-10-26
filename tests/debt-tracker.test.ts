import { describe, expect, it } from "vitest";
import {
  debtDueOccurrences,
  debtPaymentHistory,
  estimatedDebtProgress,
  paymentSplitIsValid,
  reminderMatches,
} from "@/lib/reporting/debt-tracker";
import type { Debt, DebtPayment } from "@/lib/types";

const debt = (patch: Partial<Debt> = {}): Debt => ({
  id: "d1", name: "Card", openingPrincipal: 1000, annualRate: 18, minimumPayment: 100,
  extraPayment: 0, currency: "USD", frequency: "monthly", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  ...patch,
});
const payment = (patch: Partial<DebtPayment> = {}): DebtPayment => ({
  id: "p1", debtId: "d1", date: "2026-10-15", amount: 100, createdAt: "2026-10-15T00:00:00Z", updatedAt: "2026-10-15T00:00:00Z", ...patch,
});

describe("debt payoff dashboard reporting", () => {
  it("clamps contractual due days to month length, including leap February", () => {
    const events = debtDueOccurrences([debt({ dueDay: 31, createdAt: "2024-01-01T00:00:00.000Z" })], [], "2024-02-01", "2024-02-29", "2024-02-01");
    expect(events.map((event) => event.date)).toEqual(["2024-02-29"]);
  });

  it("does not invent a due date when the user has not entered one", () => {
    expect(debtDueOccurrences([debt()], [], "2026-10-01", "2026-10-31", "2026-10-01")).toEqual([]);
  });

  it("repeats biweekly from the user-entered anchor date", () => {
    const events = debtDueOccurrences([debt({ frequency: "biweekly", nextDueDate: "2026-10-02" })], [], "2026-10-01", "2026-10-31", "2026-10-01");
    expect(events.map((event) => event.date)).toEqual(["2026-10-02", "2026-10-16", "2026-10-30"]);
  });

  it("derives paid, partial, and overdue without auto-marking overdue payments paid", () => {
    const monthly = debt({ dueDay: 15 });
    const events = debtDueOccurrences([monthly], [
      payment({ id: "partial", amount: 45 }),
      payment({ id: "full", date: "2026-11-15", amount: 100 }),
    ], "2026-10-01", "2026-11-30", "2026-11-20");
    expect(events.map((event) => event.status)).toEqual(["partial", "paid"]);
    const overdue = debtDueOccurrences([monthly], [], "2026-10-15", "2026-10-15", "2026-10-16");
    expect(overdue[0].status).toBe("overdue");
  });

  it("excludes planned and skipped payments from actual payment history", () => {
    const history = debtPaymentHistory([
      payment({ id: "actual", principal: 80, interest: 20 }),
      payment({ id: "plan", status: "planned", date: "2026-10-20" }),
      payment({ id: "skip", status: "skipped", date: "2026-10-21" }),
    ], 1, "2026-10");
    expect(history[0]).toMatchObject({ actual: 100, principal: 80, interest: 20, fees: 0 });
  });

  it("labels progress as estimated and uses only explicitly recorded principal", () => {
    const result = estimatedDebtProgress(debt(), [payment({ principal: 200 })]);
    expect(result).toMatchObject({ current: 1000, principalPaid: 200, estimatedOriginal: 1200, progressPercent: 16.67, estimate: true });
    expect(estimatedDebtProgress(debt(), [payment()]).principalPaid).toBe(0);
  });

  it("validates entered principal, interest, and fee split to the total payment", () => {
    expect(paymentSplitIsValid(100, 70, 25, 5)).toBe(true);
    expect(paymentSplitIsValid(100, 70, 20, 5)).toBe(false);
    expect(paymentSplitIsValid(100)).toBe(true);
  });

  it("matches only configured in-app reminder lead times", () => {
    expect(reminderMatches("2026-10-08", "2026-10-01", [7])).toBe(true);
    expect(reminderMatches("2026-10-08", "2026-10-01", [3])).toBe(false);
    expect(reminderMatches("2026-09-30", "2026-10-01", [1])).toBe(false);
  });
});
