import { describe, expect, it } from "vitest";
import { isPinned, addPin, removePin, movePin } from "@/lib/chart-widgets";
import type { PinnedChart } from "@/lib/chart-widgets";

const a: PinnedChart = { id: "budget.monthly", tool: "budget", chart: "budget.monthly", title: "Monthly" };
const b: PinnedChart = { id: "budget.categories", tool: "budget", chart: "budget.categories", title: "Categories" };
const c: PinnedChart = { id: "savings.goals", tool: "savings", chart: "savings.goals", title: "Goals" };

describe("pin reducers (home dashboard, spec #20)", () => {
  it("isPinned reflects membership", () => {
    expect(isPinned([a, b], "budget.monthly")).toBe(true);
    expect(isPinned([a, b], "savings.goals")).toBe(false);
  });

  it("addPin appends without duplicates and never mutates the input", () => {
    const base = [a];
    const next = addPin(base, b);
    expect(next).toHaveLength(2);
    expect(addPin(next, b)).toHaveLength(2); // idempotent
    expect(base).toHaveLength(1); // original untouched
  });

  it("removePin drops the matching id", () => {
    expect(removePin([a, b, c], "budget.categories").map((p) => p.id)).toEqual(["budget.monthly", "savings.goals"]);
  });

  it("movePin reorders and is a no-op at the boundaries", () => {
    const order = [a, b, c];
    expect(movePin(order, "budget.monthly", -1)).toEqual(order); // already first
    expect(movePin(order, "savings.goals", 1)).toEqual(order); // already last
    const moved = movePin(order, "budget.monthly", 1);
    expect(moved.map((p) => p.id)).toEqual(["budget.categories", "budget.monthly", "savings.goals"]);
  });

  it("movePin leaves unknown ids untouched", () => {
    expect(movePin([a, b], "nope", 1)).toEqual([a, b]);
  });
});
