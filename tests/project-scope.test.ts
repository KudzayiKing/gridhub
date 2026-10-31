import { describe, expect, it } from "vitest";
import type { Project, Task } from "@/lib/types";
import type { LedgerTab } from "@/components/tools/ledger-tool";
import { filterProjectTabs, resolveProjectSelection, scopeProjectData } from "@/lib/workspaces/project-scope";

const project = (id: string, deleted = false): Project => ({
  id, createdAt: "2026-01-01", updatedAt: "2026-01-01", name: id,
  startDate: "2026-01-01", status: "active", deleted,
});
const task = (id: string, projectId: string): Task => ({
  id, createdAt: "2026-01-01", updatedAt: "2026-01-01", projectId,
  title: id, status: "todo", priority: "medium", order: 0,
});

describe("project selection scope", () => {
  it("defaults to All Projects and safely falls back for stale or deleted IDs", () => {
    const projects = [project("one"), project("gone", true)];
    expect(resolveProjectSelection(projects, null)).toBeNull();
    expect(resolveProjectSelection(projects, "missing")).toBeNull();
    expect(resolveProjectSelection(projects, "gone")).toBeNull();
    expect(resolveProjectSelection(projects, "one")).toBe("one");
  });

  it("scopes project dashboard data and excludes dependency links that cross projects", () => {
    const data = {
      projects: [project("one"), project("two")],
      tasks: [task("a", "one"), task("b", "one"), task("c", "two")],
      milestones: [
        { id: "m1", createdAt: "2026-01-01", updatedAt: "2026-01-01", projectId: "one", title: "M1", done: false },
        { id: "m2", createdAt: "2026-01-01", updatedAt: "2026-01-01", projectId: "two", title: "M2", done: false },
      ],
      dependencies: [
        { id: "d1", createdAt: "2026-01-01", updatedAt: "2026-01-01", taskId: "a", dependsOnTaskId: "b" },
        { id: "d2", createdAt: "2026-01-01", updatedAt: "2026-01-01", taskId: "a", dependsOnTaskId: "c" },
      ],
    };

    expect(scopeProjectData(data, "one")).toMatchObject({
      projects: [{ id: "one" }],
      tasks: [{ id: "a" }, { id: "b" }],
      milestones: [{ id: "m1" }],
      dependencies: [{ id: "d1" }],
    });
    expect(scopeProjectData(data, null)).toBe(data);
  });

  it("applies selection to project tables while preserving existing drill filters", () => {
    const tabs = [
      { id: "tasks", label: "Tasks", collection: "tasks", filter: (row: { id: string }) => row.id !== "hidden" },
      { id: "projects", label: "Projects", collection: "projects" },
    ] as unknown as LedgerTab[];
    const data = { tasks: [task("one-task", "one"), task("other-task", "two")] };
    const [tasksTab, projectsTab] = filterProjectTabs(tabs, "one", data);
    expect(tasksTab.filter?.({ id: "one-task", projectId: "one" } as never)).toBe(true);
    expect(tasksTab.filter?.({ id: "other-task", projectId: "two" } as never)).toBe(false);
    expect(tasksTab.filter?.({ id: "hidden", projectId: "one" } as never)).toBe(false);
    expect(projectsTab.filter?.({ id: "one" } as never)).toBe(true);
    expect(projectsTab.filter?.({ id: "two" } as never)).toBe(false);
  });
});
