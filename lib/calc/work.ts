import { D, pct, round2, sumBy } from "../money";
import type { ContentPost, Habit, HabitCompletion, Project, Task, TaskDependency } from "../types";

/* ==========================================================================
   WORK TOOL 14 — Projects
   ========================================================================== */

export function isOverdue(task: Task, today = new Date().toISOString().slice(0, 10)): boolean {
  if (!task.dueDate) return false;
  return task.status !== "done" && task.dueDate < today;
}

export function projectProgress(tasks: Task[], today?: string) {
  const live = tasks.filter((t) => !t.deleted);
  const done = live.filter((t) => t.status === "done");
  const overdue = live.filter((t) => isOverdue(t, today));
  return {
    total: live.length,
    completed: done.length,
    remaining: live.length - done.length,
    completionPct: live.length > 0 ? pct(done.length, live.length) : null,
    overdue: overdue.length,
    overdueTasks: overdue,
    inProgress: live.filter((t) => t.status === "in_progress").length,
    estimateHours: round2(sumBy(live, (t) => t.estimateHours ?? 0)),
  };
}

export function projectDurationDays(project: Pick<Project, "startDate" | "endDate">): number | null {
  if (!project.endDate) return null;
  const a = new Date(`${project.startDate}T00:00:00`).getTime();
  const b = new Date(`${project.endDate}T00:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** Depth-first cycle detection over task dependencies. */
export function findDependencyCycles(deps: TaskDependency[]): string[][] {
  const graph = new Map<string, string[]>();
  for (const d of deps) {
    if (d.deleted) continue;
    const list = graph.get(d.taskId) ?? [];
    list.push(d.dependsOnTaskId);
    graph.set(d.taskId, list);
  }

  const cycles: string[][] = [];
  const state = new Map<string, 0 | 1 | 2>(); // 0 unvisited, 1 visiting, 2 done
  const stack: string[] = [];

  const visit = (node: string) => {
    const s = state.get(node) ?? 0;
    if (s === 2) return;
    if (s === 1) {
      const idx = stack.indexOf(node);
      cycles.push([...stack.slice(idx), node]);
      return;
    }
    state.set(node, 1);
    stack.push(node);
    for (const next of graph.get(node) ?? []) visit(next);
    stack.pop();
    state.set(node, 2);
  };

  for (const node of graph.keys()) visit(node);
  return cycles;
}

/** Would adding taskId → dependsOn create a cycle? */
export function wouldCreateCycle(
  deps: TaskDependency[],
  taskId: string,
  dependsOnTaskId: string,
): boolean {
  if (taskId === dependsOnTaskId) return true;
  const next = [...deps, { taskId, dependsOnTaskId } as TaskDependency];
  return findDependencyCycles(next).length > 0;
}

export const KANBAN_COLUMNS: { id: Task["status"]; label: string }[] = [
  { id: "todo", label: "To do" },
  { id: "in_progress", label: "In progress" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
];

/* ==========================================================================
   WORK TOOL 15 — Habits
   ========================================================================== */

export function isoDate(d: Date): string {
  const copy = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return copy.toISOString().slice(0, 10);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const cur = new Date(start);
  let guard = 0;
  while (cur <= end && guard < 4000) {
    out.push(isoDate(cur));
    cur.setDate(cur.getDate() + 1);
    guard++;
  }
  return out;
}

export function isScheduled(habit: Pick<Habit, "days">, date: string): boolean {
  const d = new Date(`${date}T00:00:00`);
  return habit.days.includes(d.getDay());
}

export function expectedOccurrences(habit: Habit, from: string, to: string): number {
  return dateRange(from, to).filter((d) => isScheduled(habit, d)).length;
}

export function completedDates(completions: HabitCompletion[], habitId: string): Set<string> {
  return new Set(completions.filter((c) => !c.deleted && c.habitId === habitId).map((c) => c.date));
}

export function habitStats(habit: Habit, completions: HabitCompletion[], today = isoDate(new Date())) {
  const done = completedDates(completions, habit.id);
  const start = habit.startDate && habit.startDate > today ? today : habit.startDate || today;
  const expected = expectedOccurrences(habit, start, today);
  const completed = dateRange(start, today).filter((d) => isScheduled(habit, d) && done.has(d)).length;

  // Streak walks backwards only across scheduled days.
  let streak = 0;
  const cursor = new Date(`${today}T00:00:00`);
  let guard = 0;
  // If today is scheduled but not yet done, the streak may still be alive from yesterday.
  if (isScheduled(habit, today) && !done.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (guard < 730) {
    const iso = isoDate(cursor);
    if (iso < (habit.startDate || "0000-01-01")) break;
    if (isScheduled(habit, iso)) {
      if (done.has(iso)) streak++;
      else break;
    }
    cursor.setDate(cursor.getDate() - 1);
    guard++;
  }

  const last7 = dateRange(
    isoDate(new Date(new Date(`${today}T00:00:00`).getTime() - 6 * 86_400_000)),
    today,
  );
  const weekScheduled = last7.filter((d) => isScheduled(habit, d));
  const weekDone = weekScheduled.filter((d) => done.has(d));

  return {
    streak,
    expected,
    completed,
    completionRate: expected > 0 ? pct(completed, expected) : null,
    weekScheduled: weekScheduled.length,
    weekCompleted: weekDone.length,
    weekRate: weekScheduled.length > 0 ? pct(weekDone.length, weekScheduled.length) : null,
    doneToday: done.has(today),
    lastCompleted: [...done].sort().at(-1) ?? null,
  };
}

export function habitsOverview(habits: Habit[], completions: HabitCompletion[], today = isoDate(new Date())) {
  const live = habits.filter((h) => !h.deleted && !h.archived);
  const stats = live.map((h) => ({ habit: h, stats: habitStats(h, completions, today) }));
  const scheduledToday = stats.filter((s) => isScheduled(s.habit, today));
  return {
    habits: stats,
    scheduledToday: scheduledToday.length,
    doneToday: scheduledToday.filter((s) => s.stats.doneToday).length,
    todayRate: scheduledToday.length > 0 ? pct(scheduledToday.filter((s) => s.stats.doneToday).length, scheduledToday.length) : null,
    bestStreak: Math.max(0, ...stats.map((s) => s.stats.streak)),
  };
}

/* ==========================================================================
   WORK TOOL 16 — Content planner
   ========================================================================== */

export function engagementRate(post: ContentPost): number | null {
  if (!post.reach || post.reach <= 0 || post.engagements === undefined) return null;
  return pct(post.engagements, post.reach);
}

export function contentSummary(posts: ContentPost[], period?: string) {
  const live = posts.filter((p) => !p.deleted);
  const inPeriod = period
    ? live.filter((p) => (p.scheduledDate ?? p.publishedDate ?? "").startsWith(period))
    : live;

  /*
   * An idea has no date — that is what makes it an idea. Filtering the backlog by period
   * would therefore hide every idea and every undated draft, so a period view would always
   * report an empty pipeline even when the user has a dozen concepts waiting.
   * Dated posts are still scoped to the period; undated pipeline items always count.
   */
  const isUndated = (p: ContentPost) => !p.scheduledDate && !p.publishedDate;
  const pipeline = period
    ? live.filter((p) => isUndated(p) || (p.scheduledDate ?? p.publishedDate ?? "").startsWith(period))
    : live;

  const scheduled = inPeriod.filter((p) => p.status === "scheduled");
  const published = inPeriod.filter((p) => p.status === "published");
  const planned = inPeriod.filter((p) => p.status !== "idea");

  const withMetrics = published.filter((p) => engagementRate(p) !== null);
  const totalReach = round2(sumBy(withMetrics, (p) => p.reach ?? 0));
  const totalEngagements = round2(sumBy(withMetrics, (p) => p.engagements ?? 0));

  const byPlatform = new Map<string, number>();
  for (const p of inPeriod) byPlatform.set(p.platform, (byPlatform.get(p.platform) ?? 0) + 1);

  return {
    scheduled: scheduled.length,
    published: published.length,
    drafts: pipeline.filter((p) => p.status === "draft").length,
    ideas: pipeline.filter((p) => p.status === "idea").length,
    publishingRate: planned.length > 0 ? pct(published.length, planned.length) : null,
    engagementRate: totalReach > 0 ? pct(totalEngagements, totalReach) : null,
    totalReach,
    totalEngagements,
    byPlatform: [...byPlatform.entries()].map(([platform, count]) => ({ platform, count })),
    /** Posts whose date has passed but which the user has not confirmed as published. */
    awaitingConfirmation: scheduled.filter((p) => (p.scheduledDate ?? "") < new Date().toISOString().slice(0, 10)),
  };
}

export function postsByDay(posts: ContentPost[]): Record<string, ContentPost[]> {
  const map: Record<string, ContentPost[]> = {};
  for (const p of posts.filter((x) => !x.deleted)) {
    const key = p.scheduledDate || p.publishedDate;
    if (!key) continue;
    map[key] = [...(map[key] ?? []), p];
  }
  return map;
}

export { D };
