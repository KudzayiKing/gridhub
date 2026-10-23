import { describe, expect, it } from "vitest";
import { yearOptions } from "@/lib/use-tool-period";

describe("yearOptions (universal period filter, spec #3)", () => {
  it("always includes the current year", () => {
    const opts = yearOptions([]);
    expect(opts.some((o) => o.value === String(new Date().getFullYear()))).toBe(true);
  });

  it("includes every year that has records", () => {
    const opts = yearOptions(["2024-03-10", "2026-01-05", "2023-12-31"]);
    const values = opts.map((o) => o.value);
    expect(values).toContain("2026");
    expect(values).toContain("2024");
    expect(values).toContain("2023");
  });

  it("never invents a future year that has no data", () => {
    const future = String(new Date().getFullYear() + 3);
    const opts = yearOptions(["2026-01-05"]);
    expect(opts.map((o) => o.value)).not.toContain(future);
  });

  it("sorts descending and respects the max cap", () => {
    const dates = Array.from({ length: 10 }, (_, i) => `${2000 + i}-01-01`);
    const opts = yearOptions(dates, 4);
    expect(opts.length).toBeLessThanOrEqual(4);
    const values = opts.map((o) => Number(o.value));
    expect(values[0]).toBeGreaterThanOrEqual(values[values.length - 1]);
  });
});
