import { describe, expect, it } from "vitest";
import { findKeywordOverlap, normalizeKeyword, scoreOpportunity } from "@/lib/journal/scoring";

describe("Journal keyword scoring", () => {
  it("normalizes Unicode keywords and whitespace consistently", () => {
    expect(normalizeKeyword("  Budget—Planner   for Café! ")).toBe("budget planner for café");
  });

  it("does not turn missing dimensions into zero scores", () => {
    expect(scoreOpportunity({ relevance: null, intent: null, demand: null, feasibility: null, differentiation: null })).toMatchObject({ total: null, coveragePercent: 0 });
    expect(scoreOpportunity({ relevance: 100, intent: null, demand: null, feasibility: null, differentiation: null })).toMatchObject({ total: 100, coveragePercent: 30 });
  });

  it("uses only available weights and clamps supplied component scores", () => {
    const result = scoreOpportunity({ relevance: 120, intent: 50, demand: null, feasibility: null, differentiation: null });
    expect(result.total).toBeCloseTo(77.3, 1);
    expect(result.coveragePercent).toBe(55);
  });

  it("surfaces exact primary keyword matches and strong title overlap", () => {
    const matches = findKeywordOverlap("small business budget planner", [
      { slug: "budgeting", title: "A household budget guide", primary_keyword: "small business budget planner" },
      { slug: "payroll", title: "Payroll for growing teams", primary_keyword: "payroll software" },
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ slug: "budgeting", overlap: 1 });
  });
});
