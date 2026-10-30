import { describe, expect, it } from "vitest";
import { deterministicParse, toolIdForPath } from "@/lib/ai/deterministic-parser";
import { normalizeName, resolveByName, resolveDate, resolvePeriod } from "@/lib/ai/entity-resolver";

describe("deterministic parser", () => {
  it("routes navigation verbs to real tool routes", () => {
    const match = deterministicParse("open the budget");
    expect(match?.intent).toBe("navigation");
    expect(match?.path).toBe("/app/money/budget");
  });

  it("accepts a bare tool name", () => {
    expect(deterministicParse("invoicing")?.path).toBe("/app/business/invoicing");
  });

  it("routes settings and billing", () => {
    expect(deterministicParse("go to settings")?.path).toBe("/app/settings");
    expect(deterministicParse("show me billing")?.path).toBe("/app/billing");
  });

  it("recognises the exact read-only shortcuts", () => {
    expect(deterministicParse("show my unpaid invoices")?.actionId).toBe("invoicing.query_unpaid");
    expect(deterministicParse("what is low stock")?.actionId).toBe("inventory.query_low_stock");
    expect(deterministicParse("cash flow forecast")?.actionId).toBe("cash-flow.query_forecast");
    expect(deterministicParse("what's due this week")?.actionId).toBe(
      "projects.query_deadlines",
    );
  });

  it("parses localized expense, income, and budget questions in every UI language", () => {
    const expenseCommands = [
      ["es", "Añade $45 para comida hoy"],
      ["zh-CN", "添加 $45 用于买菜"],
      ["pt-BR", "Adicione $45 para compras hoje"],
      ["fr", "Ajoute $45 pour les courses aujourd'hui"],
      ["ru", "Добавь $45 на продукты сегодня"],
      ["ar", "أضف $45 لـ مشتريات اليوم"],
    ] as const;
    for (const [language, command] of expenseCommands) {
      const parsed = deterministicParse(command, language);
      expect(parsed?.actionId, `${language} expense`).toBe("budget.create_expense");
      expect(parsed?.parameters?.amount).toBe(45);
    }

    const incomeCommands = [
      ["es", "Añade un salario de $2000"],
      ["zh-CN", "添加工资 $2000"],
      ["pt-BR", "Adicione salário de $2000"],
      ["fr", "Ajoute un salaire de $2000"],
      ["ru", "Добавь зарплату $2000"],
      ["ar", "أضف راتب $2000"],
    ] as const;
    for (const [language, command] of incomeCommands) {
      expect(deterministicParse(command, language)?.actionId, `${language} income`).toBe(
        "budget.create_income",
      );
    }

    const budgetQuestions = [
      ["es", "¿Cuánto gasté el mes pasado?"],
      ["zh-CN", "我上个月花了多少钱？"],
      ["pt-BR", "Quanto gastei no mês passado?"],
      ["fr", "Combien ai-je dépensé le mois dernier ?"],
      ["ru", "Сколько я потратил в прошлом месяце?"],
      ["ar", "كم أنفقت الشهر الماضي؟"],
    ] as const;
    for (const [language, command] of budgetQuestions) {
      expect(deterministicParse(command, language)?.actionId, `${language} query`).toBe(
        "budget.query_spend",
      );
    }
  });

  it("returns null for anything that needs the model", () => {
    expect(deterministicParse("add 40 for fuel")?.actionId).toBe("budget.create_expense");
    expect(deterministicParse("move 200 from savings to checking")).toBeNull();
    expect(deterministicParse("")).toBeNull();
  });

  it("never produces a path outside the app", () => {
    for (const phrase of ["open budget", "settings", "home", "invoicing", "habits"]) {
      const match = deterministicParse(phrase);
      if (match?.path) expect(match.path.startsWith("/app")).toBe(true);
    }
  });

  it("maps a route back to a tool id", () => {
    expect(toolIdForPath("/app/money/budget")).toBe("budget");
    expect(toolIdForPath("/app/settings")).toBeUndefined();
  });
});

describe("entity resolution", () => {
  const categories = [
    { id: "1", name: "Groceries" },
    { id: "2", name: "Groceries & Household" },
    { id: "3", name: "Transport" },
  ];

  it("normalises case and punctuation", () => {
    expect(normalizeName("  Groceries & Household! ")).toBe("groceries household");
  });

  it("resolves an exact name", () => {
    const result = resolveByName(categories, "transport", (c) => c.name);
    expect(result.status).toBe("match");
    if (result.status === "match") expect(result.record.id).toBe("3");
  });

  it("reports ambiguity instead of guessing", () => {
    const result = resolveByName(categories, "groceries", (c) => c.name);
    // "Groceries" is exact for one record, so an exact match must win over the prefix match.
    expect(result.status).toBe("match");
    if (result.status === "match") expect(result.record.id).toBe("1");
  });

  it("returns none for an unknown name", () => {
    expect(resolveByName(categories, "yacht", (c) => c.name).status).toBe("none");
  });

  it("resolves relative dates against a supplied today", () => {
    expect(resolveDate("today", "2026-03-15")).toBe("2026-03-15");
    expect(resolveDate("yesterday", "2026-03-15")).toBe("2026-03-14");
    expect(resolveDate("tomorrow", "2026-03-15")).toBe("2026-03-16");
  });

  it("treats an omitted date as today", () => {
    expect(resolveDate(undefined, "2026-03-15")).toBe("2026-03-15");
    expect(resolveDate("", "2026-03-15")).toBe("2026-03-15");
    expect(resolveDate("   ", "2026-03-15")).toBe("2026-03-15");
  });

  it("passes through an ISO date", () => {
    expect(resolveDate("2026-01-02", "2026-03-15")).toBe("2026-01-02");
  });

  it("resolves weekday names relative to today", () => {
    // 2026-03-15 is a Sunday.
    expect(resolveDate("friday", "2026-03-15")).toBe("2026-03-13");
    expect(resolveDate("last friday", "2026-03-15")).toBe("2026-03-13");
    expect(resolveDate("next friday", "2026-03-15")).toBe("2026-03-20");
    expect(resolveDate("this sunday", "2026-03-15")).toBe("2026-03-15");
    expect(resolveDate("last sunday", "2026-03-15")).toBe("2026-03-08");
  });

  it("resolves an ordinal day within the current month", () => {
    expect(resolveDate("the 3rd", "2026-03-15")).toBe("2026-03-03");
    expect(resolveDate("on the 21st", "2026-03-15")).toBe("2026-03-21");
    expect(resolveDate("3rd", "2026-03-15")).toBe("2026-03-03");
  });

  it("reads numeric dates as US month/day, inferring day-first only when unambiguous", () => {
    expect(resolveDate("12/25", "2026-03-15")).toBe("2026-12-25");
    expect(resolveDate("12/25/2025", "2026-03-15")).toBe("2025-12-25");
    expect(resolveDate("3/4", "2026-03-15")).toBe("2026-03-04");
    // 25 cannot be a month, so this can only be day/month.
    expect(resolveDate("25/12", "2026-03-15")).toBe("2026-12-25");
  });

  it("resolves month-name dates", () => {
    expect(resolveDate("Oct 3", "2026-03-15")).toBe("2026-10-03");
    expect(resolveDate("October 3, 2026", "2026-03-15")).toBe("2026-10-03");
    expect(resolveDate("3 Oct", "2026-03-15")).toBe("2026-10-03");
  });

  it("returns null for a supplied date it cannot read, so the caller asks", () => {
    // The regression this guards: these used to return today and silently book the wrong day.
    expect(resolveDate("sometime", "2026-03-15")).toBeNull();
    expect(resolveDate("whenever", "2026-03-15")).toBeNull();
  });

  it("returns null for impossible calendar dates instead of rolling over", () => {
    expect(resolveDate("2026-02-31", "2026-03-15")).toBeNull();
    expect(resolveDate("Feb 30", "2026-03-15")).toBeNull();
    expect(resolveDate("2/30", "2026-03-15")).toBeNull();
  });

  it("resolves periods to the shape the calculators expect", () => {
    expect(resolvePeriod("this month", "2026-03-15")).toBe("2026-03");
    expect(resolvePeriod("last month", "2026-03-15")).toBe("2026-02");
    expect(resolvePeriod("this year", "2026-03-15")).toBe("2026");
    expect(resolvePeriod("all", "2026-03-15")).toBe("all");
  });
});
