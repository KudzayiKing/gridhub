import { describe, expect, it } from "vitest";
import { monthlyBillOccurrences, nextPaydayDate, paycheckAllocationBreakdown } from "@/lib/reporting/paycheck";
import type { Paycheck, PaycheckAllocation, RecurringBill } from "@/lib/types";

const paycheck = { id: "p1", date: "2026-10-01", expectedAmount: 1000, savingsAllocation: 100 } as Paycheck;
const allocation = (id: string, kind: PaycheckAllocation["kind"], amount: number, extra: Partial<PaycheckAllocation> = {}) => ({ id, paycheckId: "p1", label: id, kind, amount, ...extra }) as PaycheckAllocation;

describe("paycheckAllocationBreakdown", () => {
  it("reconciles non-overlapping allocations and unallocated funds to the paycheck", () => {
    const result = paycheckAllocationBreakdown(paycheck, [allocation("rent", "bill", 500), allocation("food", "spending", 200), allocation("save", "savings", 50)]);
    expect(result.allocated).toBe(800); // legacy savings amount is a max, not added a second time
    expect(result.unallocated).toBe(200);
    expect(result.overallocated).toBe(0);
    expect(result.slices.reduce((sum, item) => sum + item.value, 0)).toBe(1000);
  });

  it("flags over-allocation without emitting negative donut values", () => {
    const result = paycheckAllocationBreakdown(paycheck, [allocation("rent", "bill", 900), allocation("spend", "spending", 300)]);
    expect(result.overallocated).toBe(300); // includes the legacy $100 savings reservation
    expect(result.unallocated).toBe(0);
    expect(result.slices.every((item) => item.value >= 0)).toBe(true);
  });

  it("uses actual received amount and ignores deleted or unrelated allocations", () => {
    const actual = { ...paycheck, actualAmount: 800 };
    const result = paycheckAllocationBreakdown(actual, [allocation("bill", "bill", 100), allocation("deleted", "bill", 500, { deleted: true }), { ...allocation("elsewhere", "bill", 500), paycheckId: "p2" }]);
    expect(result.amount).toBe(800);
    expect(result.allocated).toBe(200); // $100 bill + the legacy savings reservation
  });
});

describe("monthlyBillOccurrences", () => {
  const template = (frequency: RecurringBill["frequency"], dueDay: number, id: string = frequency) => ({ id, name: "Rent", amount: 900, dueDay, frequency, active: true } as RecurringBill);

  it("clamps monthly bill dates to the month length and does not infer other recurrence dates", () => {
    const rows = monthlyBillOccurrences([template("monthly", 31), template("annual", 15, "annual")], "2026-02-01", "2026-03-01", [], []);
    expect(rows).toHaveLength(1);
    expect(rows[0].dueDate).toBe("2026-02-28");
  });

  it("only marks a bill paid when a matching paycheck allocation explicitly says paid", () => {
    const bill = template("monthly", 5, "rent");
    const check = { ...paycheck, date: "2026-10-01" };
    const rows = monthlyBillOccurrences([bill], "2026-10-01", "2026-11-01", [check], [allocation("Rent", "bill", 900, { paid: true })]);
    expect(rows[0]).toMatchObject({ paid: true, linked: true });
  });
});

describe("nextPaydayDate", () => {
  it("advances weekly, biweekly, semimonthly and monthly schedules from their stored next date", () => {
    expect(nextPaydayDate("weekly", "2026-10-01", "2026-10-20")).toBe("2026-10-22");
    expect(nextPaydayDate("biweekly", "2026-10-01", "2026-10-20")).toBe("2026-10-29");
    expect(nextPaydayDate("semimonthly", "2026-10-01", "2026-10-20")).toBe("2026-10-31");
    expect(nextPaydayDate("monthly", "2026-01-31", "2026-03-01")).toBe("2026-03-31");
  });
});
