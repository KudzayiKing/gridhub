import type { Project, Task, Milestone, TaskDependency } from "../types";
import type { DataMap } from "../tools/shared";
import type { LedgerTab } from "../../components/tools/ledger-tool";

/** Resolve a selected project safely; null is the All Projects view. */
export function resolveProjectSelection(projects: Project[], selectedProjectId: string | null): string | null {
  if (!selectedProjectId) return null;
  return projects.some((project) => !project.deleted && project.id === selectedProjectId)
    ? selectedProjectId
    : null;
}

/**
 * Apply one project scope to all project-domain collections. User data stays in
 * All Projects when its parent reference is missing; a selected project view
 * includes only records explicitly linked to that project.
 */
export function scopeProjectData(data: DataMap, projectId: string | null): DataMap {
  if (!projectId) return data;
  const tasks = (data.tasks ?? []) as Task[];
  const scopedTasks = tasks.filter((task) => task.projectId === projectId);
  const taskIds = new Set(scopedTasks.map((task) => task.id));
  return {
    ...data,
    projects: (data.projects ?? []).filter((project) => project.id === projectId),
    tasks: scopedTasks,
    milestones: ((data.milestones ?? []) as Milestone[]).filter((milestone) => milestone.projectId === projectId),
    dependencies: ((data.dependencies ?? []) as TaskDependency[]).filter(
      (dependency) => taskIds.has(dependency.taskId) && taskIds.has(dependency.dependsOnTaskId),
    ),
  };
}

export function filterProjectTabs(
  tabs: LedgerTab[],
  projectId: string | null,
  data: DataMap,
): LedgerTab[] {
  if (!projectId) return tabs;
  const projectCollections = new Set(["projects", "tasks", "milestones", "dependencies"]);
  const projectTasks = new Set(((data.tasks ?? []) as Task[]).filter((task) => task.projectId === projectId).map((task) => task.id));
  return tabs.map((tab) => {
    if (!projectCollections.has(tab.collection)) return tab;
    const scopeFilter = (row: { id?: string; projectId?: string; taskId?: string; dependsOnTaskId?: string }) => {
      if (tab.collection === "projects") return row.id === projectId;
      if (tab.collection === "tasks" || tab.collection === "milestones") return row.projectId === projectId;
      return projectTasks.has(row.taskId ?? "") && projectTasks.has(row.dependsOnTaskId ?? "");
    };
    return { ...tab, filter: (row) => (!tab.filter || tab.filter(row)) && scopeFilter(row) };
  });
}
