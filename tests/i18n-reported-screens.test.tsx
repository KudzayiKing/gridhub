/**
 * Renders the screens the user reported as "still English in Russian" and asserts the
 * visible text is Russian.
 *
 * This is deliberately a *render* test, not a catalog test. `tests/i18n-coverage.test.ts`
 * proves the catalog has entries; it cannot see a component that never calls `t()`, that
 * passes an English literal to a child which also fails to translate it, or — the inverse
 * bug — a child that translates a label the caller marked as raw user data. Those are
 * exactly the defects reported here, so they are verified at the DOM level.
 */
import * as React from "react";
import { act, render, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

/*
 * Force the interface language to Russian. `useI18n` reads `usePrefs()`, so overriding the
 * provider is enough for every component under test — no per-component mocking.
 */
vi.mock("@/components/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/providers")>();
  const ru = {
    prefs: {
      id: "prefs",
      currency: "USD",
      locale: "ru-RU",
      uiLanguage: "ru",
      uiLanguageManuallySet: true,
      dateFormat: "DD.MM.YYYY",
      timeZone: "Europe/Moscow",
      theme: "dark",
      reducedMotion: false,
      createdAt: "",
      updatedAt: "",
    },
    setPrefs: async () => {},
    loading: false,
  };
  return {
    ...actual,
    usePrefs: () => ru,
    useSyncState: () => ({ phase: "local", pending: 0, lastSyncedAt: null }),
  };
});

/*
 * jsdom reports zero width for every element, so Recharts' `ResponsiveContainer` renders an
 * empty box and no axis tick or series name ever reaches the DOM — asserting on chart text
 * with the real library is impossible, not merely flaky.
 *
 * These stubs keep the data flow intact and surface exactly the strings this suite cares
 * about: the row label each series is keyed by (`data[].label` / `data[].name`) and the
 * `name` of each series. Everything visual is deliberately discarded.
 */
vi.mock("recharts", () => {
  const Box = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const DataChart = ({ data, children }: { data?: Record<string, unknown>[]; children?: React.ReactNode }) => (
    <div>
      {(data ?? []).map((row, i) => (
        <span key={i}>{String(row.label ?? row.name ?? "")}</span>
      ))}
      {children}
    </div>
  );
  const Series = ({ name }: { name?: string }) => (name ? <span>{name}</span> : null);
  return {
    ResponsiveContainer: Box,
    BarChart: DataChart,
    PieChart: Box,
    Bar: Series,
    Pie: Series,
    Cell: () => null,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
  };
});

const { BudgetVsActualChart } = await import("@/components/charts/budget-vs-actual-chart");
const { CategoryBreakdownChart } = await import("@/components/charts/category-breakdown-chart");
const { RecordForm } = await import("@/components/data/record-form");
const { OperationsHero } = await import("@/components/tools/operations-dashboard");
const { TooltipProvider } = await import("@/components/ui/overlay");
const { useGoalLabel } = await import("@/lib/goal-label");

/**
 * Charts gate their first paint behind `useMounted()` (one `requestAnimationFrame`) so the
 * server and the client agree on markup. Flush that frame inside `act` before asserting.
 */
async function renderSettled(node: React.ReactNode) {
  const result = render(<TooltipProvider>{node}</TooltipProvider>);
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
  return result;
}

const fmt = (v: number | string | undefined) => `$${Number(v ?? 0)}`;

describe("reported screens render in Russian", () => {
  it("(2) paycheck budget-vs-actual chart: row label, series names and legend", async () => {
    const { container } = await renderSettled(
      <BudgetVsActualChart data={[{ category: "Uncategorized", budget: 0, actual: 10500 }]} formatValue={fmt} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Без категории");
    expect(text).toContain("Бюджет");
    expect(text).toContain("В пределах бюджета");
    expect(text).toContain("Сверх бюджета");
    // The old bug: the literal "Uncategorized" reached the Y axis.
    expect(text).not.toContain("Uncategorized");
    expect(text).not.toContain("Within budget");
    expect(text).not.toContain("Over budget");
  });

  it("(2) keeps a user-authored category name exactly as typed", async () => {
    const { container } = await renderSettled(
      <BudgetVsActualChart data={[{ category: "Income", budget: 100, actual: 50 }]} formatValue={fmt} />,
    );
    // "Income" is a catalog key, but here it is the user's own category — it must not be translated.
    expect(container.textContent).toContain("Income");
    expect(container.textContent).not.toContain("Доход");
  });

  it("(6/7) tool dashboard sub-header is Russian", async () => {
    const { container } = await renderSettled(<OperationsHero toolId="bookkeeping" data={{}} currency="USD" />);
    const text = container.textContent ?? "";
    expect(text).toContain("Расходы по категориям");
    expect(text).not.toContain("Expenses by category");
  });

  it("(7) inventory sub-header is Russian", async () => {
    const { container } = await renderSettled(<OperationsHero toolId="inventory" data={{}} currency="USD" />);
    const text = container.textContent ?? "";
    expect(text).toContain("Стоимость запасов по категориям");
    expect(text).not.toContain("Inventory value by category");
  });

  it("(8) add-record panel: field labels, option labels and actions are Russian", async () => {
    await renderSettled(
      <RecordForm
        open
        onOpenChange={() => {}}
        onSubmit={() => {}}
        title="New {item}"
        fields={[
          { key: "date", label: "Date", type: "date" },
          {
            key: "type",
            label: "Type",
            type: "select",
            options: [
              { value: "income", label: "Income" },
              { value: "expense", label: "Expense" },
            ],
          },
          {
            key: "categoryId",
            label: "Category",
            type: "select",
            // `options()` output: user data, must stay verbatim.
            options: [{ value: "c1", label: "Groceries", raw: true }],
          },
          { key: "notes", label: "Notes", type: "textarea" },
        ]}
      />,
    );
    const text = document.body.textContent ?? "";
    expect(text).toContain("Дата");
    expect(text).toContain("Тип");
    expect(text).toContain("Категория");
    expect(text).toContain("Примечания");
    // Static option labels translate…
    expect(text).toContain("Доход");
    expect(text).toContain("Расход");
    // …while a user-entered category is left alone.
    expect(text).toContain("Groceries");
    expect(text).not.toContain("Продукты питания");
    // "Select…" placeholder and the Cancel button.
    expect(text).toContain("Выберите…");
    expect(text).toContain("Отмена");
    expect(text).not.toContain("Select…");
  });

  it("(4) savings donut translates only the system Uncategorized label", async () => {
    const { container } = await renderSettled(
      <CategoryBreakdownChart
        data={[
          { id: "a", name: "Uncategorized", value: 10 },
          { id: "b", name: "Holiday", value: 5 },
        ]}
        formatValue={fmt}
        centerLabel="Total saved"
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Без категории");
    expect(text).toContain("Holiday");
    expect(text).toContain("Всего накоплено");
  });
});

describe("savings goal labels", () => {
  it("(4) translates the seeded emergency-fund name and leaves every other name alone", () => {
    const { result } = renderHook(() => useGoalLabel());
    const label = result.current;

    // The app's own default, so it is translated…
    expect(label({ name: "Emergency Fund", kind: "emergency" })).toBe("Подушка безопасности");
    // …including the casing/spacing variants a person may have typed over it.
    expect(label({ name: " emergency fund ", kind: "emergency" })).toBe("Подушка безопасности");

    // A renamed emergency goal is the person's own words and must survive verbatim.
    expect(label({ name: "Чёрный день", kind: "emergency" })).toBe("Чёрный день");
    // A normal goal that happens to share the default name is user data too.
    expect(label({ name: "Emergency Fund", kind: "goal" })).toBe("Emergency Fund");
    // And an ordinary goal name is never translated.
    expect(label({ name: "Holiday", kind: "goal" })).toBe("Holiday");
  });
});
