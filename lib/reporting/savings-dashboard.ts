import { D, round2, sumBy } from "@/lib/money";
import type { GoalMovement, SavingsGoal } from "@/lib/types";

export type SavingsProgressStatus = "On Track" | "Ahead of Schedule" | "Behind Schedule" | "Goal Complete" | "No Target Date" | "Insufficient Data";

export interface SavingsGoalDashboardRow {
  goal: SavingsGoal;
  balance: number;
  target: number;
  remaining: number;
  percent: number | null;
  contributions: number;
  withdrawals: number;
  requiredMonthly: number | null;
  status: SavingsProgressStatus;
  monthsRemaining: number | null;
  projectedCompletionDate: string | null;
}

function monthsBetween(today: string, targetDate: string): number {
  const now = new Date(today + "T00:00:00");
  const target = new Date(targetDate + "T00:00:00");
  if (!Number.isFinite(now.getTime()) || !Number.isFinite(target.getTime()) || target <= now) return 0;
  const diff = (target.getFullYear() - now.getFullYear()) * 12 + target.getMonth() - now.getMonth();
  return Math.max(1, diff);
}

function validAmount(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function addMonthsClamped(isoDate: string, months: number): string {
  const source = new Date(isoDate + "T00:00:00");
  const day = source.getDate();
  const next = new Date(source.getFullYear(), source.getMonth() + months, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next.getFullYear() + "-" + String(next.getMonth() + 1).padStart(2, "0") + "-" + String(next.getDate()).padStart(2, "0");
}

export function savingsGoalRows(goals: SavingsGoal[], movements: GoalMovement[], today: string): SavingsGoalDashboardRow[] {
  return goals.filter((goal) => !goal.deleted).map((goal) => {
    const active = movements.filter((movement) => !movement.deleted && movement.goalId === goal.id);
    const contributions = round2(sumBy(active.filter((movement) => movement.kind === "contribution"), (movement) => validAmount(movement.amount)));
    const withdrawals = round2(sumBy(active.filter((movement) => movement.kind === "withdrawal"), (movement) => validAmount(movement.amount)));
    const balance = round2(Math.max(0, Number(D(validAmount(goal.openingBalance)).plus(contributions).minus(withdrawals))));
    const target = round2(validAmount(goal.targetAmount));
    const remaining = round2(Math.max(0, Number(D(target).minus(balance))));
    const percent = target > 0 ? round2(balance / target * 100) : null;
    const monthsRemaining = goal.targetDate ? monthsBetween(today, goal.targetDate) : null;
    let requiredMonthly: number | null = null;
    if (!remaining) requiredMonthly = 0;
    else if (monthsRemaining != null && monthsRemaining > 0) {
      const monthlyRate = Math.max(0, goal.annualInterestRate ?? 0) / 1200;
      requiredMonthly = monthlyRate > 0
        ? round2(remaining * monthlyRate / (Math.pow(1 + monthlyRate, monthsRemaining) - 1))
        : round2(remaining / monthsRemaining);
    }
    let status: SavingsProgressStatus;
    if (target > 0 && remaining === 0) status = "Goal Complete";
    else if (!goal.targetDate) status = "No Target Date";
    else if (!goal.startDate) status = "Insufficient Data";
    else if (today > goal.targetDate) status = "Behind Schedule";
    else {
      const start = new Date(goal.startDate + "T00:00:00").getTime();
      const end = new Date(goal.targetDate + "T00:00:00").getTime();
      const current = new Date(today + "T00:00:00").getTime();
      if (![start, end, current].every(Number.isFinite) || end <= start) status = "Insufficient Data";
      else {
        const elapsed = Math.max(0, Math.min(1, (current - start) / (end - start)));
        const initial = validAmount(goal.openingBalance);
        const expected = initial + Math.max(0, target - initial) * elapsed;
        const tolerance = Math.max(1, target * 0.01);
        status = balance > expected + tolerance ? "Ahead of Schedule" : balance + tolerance >= expected ? "On Track" : "Behind Schedule";
      }
    }
    return {
      goal, balance, target, remaining, percent, contributions, withdrawals, requiredMonthly, status, monthsRemaining,
      projectedCompletionDate: projectedCompletionDate(goal, balance, today),
    };
  });
}

export function projectedCompletionDate(goal: SavingsGoal, currentBalance: number, today: string): string | null {
  const target = validAmount(goal.targetAmount);
  if (target <= currentBalance) return today;
  const contribution = validAmount(goal.monthlyContribution ?? 0) * (goal.contributionFrequency === "weekly" ? 52 / 12 : goal.contributionFrequency === "biweekly" ? 26 / 12 : 1);
  if (contribution <= 0) return null;
  const monthlyRate = Math.max(0, goal.annualInterestRate ?? 0) / 1200;
  let balance = validAmount(currentBalance);
  for (let month = 1; month <= 1200; month += 1) {
    balance = round2(Number(D(balance).times(1 + monthlyRate).plus(contribution)));
    if (balance >= target) {
      return addMonthsClamped(today, month);
    }
  }
  return null;
}

export function savingsMovementMonths(movements: GoalMovement[], range: 3 | 6 | 12 | "all", today: string, goalId?: string) {
  const end = new Date(today + "T00:00:00");
  const relevant = movements.filter((movement) => !movement.deleted && (!goalId || movement.goalId === goalId));
  const earliest = relevant.map((movement) => movement.date.slice(0, 7)).filter(Boolean).sort()[0];
  const start = range === "all" && earliest
    ? new Date(earliest + "-01T00:00:00")
    : new Date(end.getFullYear(), end.getMonth() - (range === "all" ? 11 : range - 1), 1);
  const months = Math.max(1, Math.min(600, (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1));
  const result = Array.from({ length: months }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const key = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
    return { key, month: date.toLocaleDateString(undefined, { month: "short", year: "2-digit" }), contributions: 0, withdrawals: 0, net: 0 };
  });
  const byMonth = new Map(result.map((row) => [row.key, row]));
  for (const movement of relevant) {
    const row = byMonth.get(movement.date.slice(0, 7));
    if (!row) continue;
    const amount = validAmount(movement.amount);
    if (movement.kind === "contribution") row.contributions = round2(row.contributions + amount);
    else row.withdrawals = round2(row.withdrawals + amount);
    row.net = round2(row.contributions - row.withdrawals);
  }
  return result;
}

export function savingsBalanceTrend(goals: SavingsGoal[], movements: GoalMovement[], range: 3 | 6 | 12 | "all", today: string, goalId?: string) {
  const selectedGoals = goals.filter((goal) => !goal.deleted && (!goalId || goal.id === goalId));
  const selectedMovements = movements.filter((movement) => !movement.deleted && selectedGoals.some((goal) => goal.id === movement.goalId));
  const activity = savingsMovementMonths(selectedMovements, range, today);
  if (!selectedMovements.length) return [];
  const firstMonth = activity[0]?.key ?? "9999-99";
  const earlierActivity = sumBy(selectedMovements.filter((movement) => movement.date.slice(0, 7) < firstMonth), (movement) => movement.kind === "withdrawal" ? -validAmount(movement.amount) : validAmount(movement.amount));
  let balance = round2(Number(D(sumBy(selectedGoals, (goal) => Math.max(0, goal.openingBalance))).plus(earlierActivity)));
  return activity.map((month) => {
    balance = round2(balance + month.net);
    return { ...month, balance };
  });
}

