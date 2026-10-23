"use client";

import * as React from "react";
import { useCollection } from "./store";
import { useActiveTools } from "./use-tools";
import { usePrefs } from "@/components/providers";
import { budgetSummary, currentMonth, currentYear, goalSummary, savingsTotals } from "./calc/money";
import { invoicingSummary } from "./calc/business";
import { habitsOverview, projectProgress } from "./calc/work";
import { contentSummary } from "./calc/work";
import { dailyTotals } from "./calc/life";
import type {
  ContentPost,
  GoalMovement,
  Habit,
  HabitCompletion,
  Invoice,
  MoneyBudget,
  MoneyCategory,
  MoneyTransaction,
  NutritionLog,
  Payment,
  Project,
  RecurringBill,
  SavingsGoal,
  Task,
} from "./types";

/**
 * Dashboard data is assembled only from collections belonging to activated tools.
 * Nothing is fabricated: every number below comes from a real local record, and a
 * missing record produces an explicit empty state rather than a placeholder value.
 */
export function useDashboardData() {
  const { active } = useActiveTools();
  const { prefs } = usePrefs();
  const currency = prefs.currency || "USD";

  const has = (id: string) => active.includes(id as never);

  const money = useCollection<MoneyTransaction>("budget", "transactions");
  const categories = useCollection<MoneyCategory>("budget", "categories");
  const budgets = useCollection<MoneyBudget>("budget", "budgets");
  const bills = useCollection<RecurringBill>("budget", "bills");

  const goals = useCollection<SavingsGoal>("savings", "goals");
  const movements = useCollection<GoalMovement>("savings", "movements");

  const invoices = useCollection<Invoice>("invoicing", "invoices");
  const payments = useCollection<Payment>("invoicing", "payments");

  const tasks = useCollection<Task>("projects", "tasks");
  const projects = useCollection<Project>("projects", "projects");

  const habits = useCollection<Habit>("habits", "habits");
  const completions = useCollection<HabitCompletion>("habits", "completions");

  const posts = useCollection<ContentPost>("content", "posts");
  const nutritionLogs = useCollection<NutritionLog>("nutrition", "logs");

  const month = currentMonth();
  const year = currentYear();

  const budget = React.useMemo(
    () =>
      budgetSummary({
        transactions: money.rows,
        categories: categories.rows,
        budgets: budgets.rows,
        period: month,
        currency,
      }),
    [money.rows, categories.rows, budgets.rows, month, currency],
  );

  const annual = React.useMemo(
    () =>
      budgetSummary({
        transactions: money.rows,
        categories: categories.rows,
        budgets: budgets.rows,
        period: year,
        currency,
      }),
    [money.rows, categories.rows, budgets.rows, year, currency],
  );

  const savings = React.useMemo(
    () => savingsTotals(goals.rows, movements.rows),
    [goals.rows, movements.rows],
  );

  const invoicing = React.useMemo(
    () => invoicingSummary(invoices.rows, payments.rows),
    [invoices.rows, payments.rows],
  );

  const taskStats = React.useMemo(() => projectProgress(tasks.rows), [tasks.rows]);
  const habitStats = React.useMemo(() => habitsOverview(habits.rows, completions.rows), [habits.rows, completions.rows]);
  const content = React.useMemo(() => contentSummary(posts.rows, month), [posts.rows, month]);

  const billsDue = React.useMemo(() => {
    if (!has("budget")) return [];
    const today = new Date().getDate();
    return bills.rows
      .filter((b) => b.active && !b.deleted)
      .map((b) => ({ bill: b, days: b.dueDay - today }))
      .filter((x) => x.days >= 0 && x.days <= 10)
      .sort((a, b) => a.days - b.days);
  }, [bills.rows, has]);

  const attention = React.useMemo(() => {
    const items: {
      id: string;
      title: string;
      detail: string;
      href: string;
      tone: "negative" | "warning" | "neutral";
      icon: string;
    }[] = [];

    if (has("budget")) {
      for (const { bill, days } of billsDue) {
        items.push({
          id: `bill-${bill.id}`,
          title: bill.name,
          detail: days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`,
          href: "/app/money/budget",
          tone: days <= 2 ? "negative" : "warning",
          icon: "calendar-days",
        });
      }
    }

    if (has("invoicing")) {
      for (const row of invoicing.overdue.slice(0, 3)) {
        items.push({
          id: `inv-${row.invoice.id}`,
          title: `Invoice ${row.invoice.number}`,
          detail: `${row.totals.overdueDays} days overdue`,
          href: "/app/business/invoicing",
          tone: "negative",
          icon: "file-text",
        });
      }
    }

    if (has("projects")) {
      for (const task of taskStats.overdueTasks.slice(0, 3)) {
        items.push({
          id: `task-${task.id}`,
          title: task.title,
          detail: `Due ${task.dueDate}`,
          href: "/app/work/projects",
          tone: "warning",
          icon: "kanban",
        });
      }
    }

    if (has("content")) {
      for (const post of content.awaitingConfirmation.slice(0, 2)) {
        items.push({
          id: `post-${post.id}`,
          title: post.title,
          detail: "Scheduled date passed — confirm if published",
          href: "/app/work/content",
          tone: "warning",
          icon: "calendar-range",
        });
      }
    }

    return items;
  }, [billsDue, invoicing, taskStats, content, has]);

  const loading =
    money.loading || goals.loading || invoices.loading || tasks.loading || habits.loading || posts.loading;

  const recent = React.useMemo(() => {
    const rows: { id: string; title: string; meta: string; at: string; icon: string }[] = [];
    if (has("budget")) {
      for (const t of money.rows.slice(0, 4)) {
        rows.push({
          id: `tx-${t.id}`,
          title: t.description,
          meta: `${t.type} · ${t.amount.toFixed(2)}`,
          at: t.date,
          icon: t.type === "income" ? "arrowUp" : t.type === "expense" ? "arrowDown" : "swap",
        });
      }
    }
    if (has("projects")) {
      for (const t of tasks.rows.filter((x) => x.status === "done").slice(0, 3)) {
        rows.push({
          id: `task-${t.id}`,
          title: t.title,
          meta: "Task completed",
          at: t.completedAt ?? t.updatedAt,
          icon: "check",
        });
      }
    }
    return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  }, [money.rows, tasks.rows, has]);

  return {
    active,
    has,
    currency,
    budget,
    annual,
    savings,
    invoicing,
    taskStats,
    habitStats,
    content,
    billsDue,
    attention,
    recent,
    loading,
    counts: {
      transactions: money.rows.length,
      goals: goals.rows.length,
      invoices: invoices.rows.length,
      tasks: tasks.rows.length,
      projects: projects.rows.length,
      habits: habits.rows.length,
      posts: posts.rows.length,
    },
    todayNutrition: dailyTotals(nutritionLogs.rows, new Date().toISOString().slice(0, 10)),
    goalSummary: (g: SavingsGoal) => goalSummary(g, movements.rows),
  };
}
