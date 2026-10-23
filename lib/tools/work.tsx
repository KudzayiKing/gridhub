import { defineTab, type LedgerTab } from "@/components/tools/ledger-tool";
import { formatDate } from "@/lib/utils";
import type {
  ContentCampaign,
  ContentPost,
  Habit,
  HabitCompletion,
  Milestone,
  Project,
  Task,
  TaskDependency,
} from "@/lib/types";
import { options, rows, today, type DataMap } from "./shared";

const STATUSES = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

export function projectTabs(data: DataMap): LedgerTab[] {
  const projects = rows<Project>(data, "projects");
  const milestones = rows<Milestone>(data, "milestones");
  const tasks = rows<Task>(data, "tasks");

  return [
    defineTab<Task>({
      id: "tasks",
      label: "Tasks",
      icon: "list",
      collection: "tasks",
      addLabel: "Add task",
      emptyTitle: "No tasks yet",
      emptyDescription: "Add tasks to see progress, overdue counts and the board.",
      searchText: (r) => r.title,
      defaults: { status: "todo", priority: "medium", order: 0, startDate: today() },
      fields: [
        { key: "title", label: "Task", type: "text", required: true },
        { key: "projectId", label: "Project", type: "select", options: options(projects), required: true },
        { key: "status", label: "Status", type: "select", options: STATUSES, defaultValue: "todo" },
        { key: "priority", label: "Priority", type: "select", options: [{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }], defaultValue: "medium" },
        { key: "startDate", label: "Start date", type: "date" },
        { key: "dueDate", label: "Due date", type: "date" },
        { key: "estimateHours", label: "Estimate (hours)", type: "number", min: 0, step: "0.5" },
        { key: "milestoneId", label: "Milestone", type: "select", options: options(milestones) },
      ],
      columns: [
        { key: "title", header: "Task", primary: true, value: (r) => r.title, render: (r) => <span className={r.status === "done" ? "text-fg-subtle line-through" : ""}>{r.title}</span> },
        { key: "projectId", header: "Project", value: (r) => projects.find((p) => p.id === r.projectId)?.name ?? "—", render: (r) => projects.find((p) => p.id === r.projectId)?.name ?? "—" },
        { key: "status", header: "Status", value: (r) => r.status, render: (r) => <span className="capitalize text-fg-muted">{r.status.replace("_", " ")}</span> },
        { key: "priority", header: "Priority", value: (r) => r.priority, render: (r) => <span className="capitalize">{r.priority}</span> },
        { key: "dueDate", header: "Due", value: (r) => r.dueDate ?? "", render: (r) => formatDate(r.dueDate) },
      ],
    }),
    defineTab<Project>({
      id: "projects",
      label: "Projects",
      icon: "folder",
      collection: "projects",
      addLabel: "Add project",
      emptyTitle: "No projects",
      emptyDescription: "Create a project to group tasks, milestones and deadlines.",
      fields: [
        { key: "name", label: "Project", type: "text", required: true },
        { key: "description", label: "Description", type: "textarea", span: 2 },
        { key: "startDate", label: "Start", type: "date", required: true, defaultValue: today() },
        { key: "endDate", label: "Target end", type: "date" },
        { key: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "paused", label: "Paused" }, { value: "done", label: "Done" }], defaultValue: "active" },
      ],
      columns: [
        { key: "name", header: "Project", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "startDate", header: "Start", value: (r) => r.startDate, render: (r) => formatDate(r.startDate) },
        { key: "endDate", header: "End", value: (r) => r.endDate ?? "", render: (r) => formatDate(r.endDate) },
        { key: "status", header: "Status", value: (r) => r.status, render: (r) => <span className="capitalize">{r.status}</span> },
      ],
    }),
    defineTab<Milestone>({
      id: "milestones",
      label: "Milestones",
      icon: "flag",
      collection: "milestones",
      addLabel: "Add milestone",
      emptyTitle: "No milestones",
      emptyDescription: "Milestones mark the moments that matter inside a project.",
      fields: [
        { key: "projectId", label: "Project", type: "select", options: options(projects), required: true },
        { key: "title", label: "Milestone", type: "text", required: true },
        { key: "dueDate", label: "Due", type: "date" },
        { key: "done", label: "Complete", type: "checkbox" },
      ],
      columns: [
        { key: "title", header: "Milestone", primary: true, value: (r) => r.title, render: (r) => r.title },
        { key: "dueDate", header: "Due", value: (r) => r.dueDate ?? "", render: (r) => formatDate(r.dueDate) },
        { key: "done", header: "Complete", value: (r) => (r.done ? 1 : 0), render: (r) => (r.done ? "Yes" : "No") },
      ],
    }),
    defineTab<TaskDependency>({
      id: "dependencies",
      label: "Dependencies",
      icon: "link",
      collection: "dependencies",
      addLabel: "Add dependency",
      emptyTitle: "No dependencies",
      emptyDescription: "Link tasks that must finish first. Circular links are rejected.",
      fields: [
        { key: "taskId", label: "Task", type: "select", options: options(tasks), required: true },
        { key: "dependsOnTaskId", label: "Depends on", type: "select", options: options(tasks), required: true },
      ],
      columns: [
        { key: "taskId", header: "Task", primary: true, value: (r) => tasks.find((t) => t.id === r.taskId)?.title ?? "—", render: (r) => tasks.find((t) => t.id === r.taskId)?.title ?? "—" },
        { key: "dependsOnTaskId", header: "Depends on", value: (r) => tasks.find((t) => t.id === r.dependsOnTaskId)?.title ?? "—", render: (r) => tasks.find((t) => t.id === r.dependsOnTaskId)?.title ?? "—" },
      ],
    }),
  ];
}

const WEEKDAYS = [
  { value: "0", label: "Sun" },
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
];

export function habitTabs(data: DataMap): LedgerTab[] {
  const habits = rows<Habit>(data, "habits");
  return [
    defineTab<Habit>({
      id: "habits",
      label: "Habits",
      icon: "circle-check",
      collection: "habits",
      addLabel: "Add habit",
      emptyTitle: "No habits yet",
      emptyDescription: "Add a habit and the days it runs. Streaks only count scheduled days.",
      defaults: { days: [1, 2, 3, 4, 5], frequency: "custom", startDate: today() },
      fields: [
        { key: "name", label: "Habit", type: "text", required: true },
        { key: "frequency", label: "Frequency", type: "select", options: [{ value: "daily", label: "Every day" }, { value: "weekly", label: "Weekly" }, { value: "custom", label: "Specific days" }], defaultValue: "daily" },
        { key: "startDate", label: "Start date", type: "date", required: true, defaultValue: today() },
        { key: "targetPerWeek", label: "Target per week", type: "number", min: 0, max: 7 },
        { key: "note", label: "Note", type: "text" },
      ],
      columns: [
        { key: "name", header: "Habit", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "frequency", header: "Frequency", value: (r) => r.frequency, render: (r) => r.frequency },
        {
          key: "days",
          header: "Days",
          value: (r) => r.days.join(""),
          render: (r) => WEEKDAYS.filter((d) => r.days.includes(Number(d.value))).map((d) => d.label).join(" "),
        },
      ],
    }),
    defineTab<HabitCompletion>({
      id: "completions",
      label: "History",
      icon: "calendar",
      collection: "completions",
      addLabel: "Mark complete",
      emptyTitle: "No completions",
      emptyDescription: "Completions drive streaks and completion rates.",
      fields: [
        { key: "habitId", label: "Habit", type: "select", options: options(habits), required: true },
        { key: "date", label: "Date", type: "date", required: true, defaultValue: today() },
      ],
      columns: [
        { key: "date", header: "Date", primary: true, value: (r) => r.date, render: (r) => formatDate(r.date) },
        { key: "habitId", header: "Habit", value: (r) => habits.find((h) => h.id === r.habitId)?.name ?? "—", render: (r) => habits.find((h) => h.id === r.habitId)?.name ?? "—" },
      ],
    }),
  ];
}

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "newsletter", label: "Newsletter" },
  { value: "blog", label: "Blog" },
];

export function contentTabs(data: DataMap): LedgerTab[] {
  const campaigns = rows<ContentCampaign>(data, "campaigns");
  return [
    defineTab<ContentPost>({
      id: "posts",
      label: "Content",
      icon: "image",
      collection: "posts",
      addLabel: "Add content",
      emptyTitle: "No content planned",
      emptyDescription: "Capture ideas, drafts and scheduled posts. Nothing is marked published until you confirm it.",
      searchText: (r) => `${r.title} ${r.notes ?? ""} ${r.campaign ?? ""}`,
      defaults: { status: "idea", platform: "instagram", contentType: "post", metricBasis: "reach" },
      fields: [
        { key: "title", label: "Title", type: "text", required: true },
        { key: "platform", label: "Platform", type: "select", options: PLATFORMS, required: true },
        { key: "contentType", label: "Format", type: "select", options: [{ value: "post", label: "Post" }, { value: "story", label: "Story" }, { value: "reel", label: "Reel" }, { value: "video", label: "Video" }, { value: "article", label: "Article" }, { value: "newsletter", label: "Newsletter" }], defaultValue: "post" },
        { key: "status", label: "Status", type: "select", options: [{ value: "idea", label: "Idea" }, { value: "draft", label: "Draft" }, { value: "scheduled", label: "Scheduled" }, { value: "published", label: "Published" }], defaultValue: "idea" },
        { key: "scheduledDate", label: "Scheduled date", type: "date" },
        { key: "publishedDate", label: "Published date", type: "date" },
        { key: "campaign", label: "Campaign", type: "select", options: options(campaigns) },
        { key: "notes", label: "Notes", type: "textarea", span: 2 },
        { key: "reach", label: "Reach", type: "number", min: 0 },
        { key: "engagements", label: "Engagements", type: "number", min: 0 },
        { key: "metricBasis", label: "Metric basis", type: "select", options: [{ value: "reach", label: "Reach" }, { value: "impressions", label: "Impressions" }, { value: "followers", label: "Followers" }] },
      ],
      columns: [
        { key: "title", header: "Title", primary: true, value: (r) => r.title, render: (r) => r.title },
        { key: "platform", header: "Platform", value: (r) => r.platform, render: (r) => <span className="capitalize">{r.platform}</span> },
        { key: "status", header: "Status", value: (r) => r.status, render: (r) => <span className="capitalize text-fg-muted">{r.status}</span> },
        { key: "scheduledDate", header: "Scheduled", value: (r) => r.scheduledDate ?? "", render: (r) => formatDate(r.scheduledDate) },
      ],
    }),
    defineTab<ContentCampaign>({
      id: "campaigns",
      label: "Campaigns",
      icon: "tag",
      collection: "campaigns",
      addLabel: "Add campaign",
      emptyTitle: "No campaigns",
      emptyDescription: "Group content into campaigns to see what belongs together.",
      fields: [
        { key: "name", label: "Campaign", type: "text", required: true },
        { key: "startDate", label: "Start", type: "date" },
        { key: "endDate", label: "End", type: "date" },
        { key: "goal", label: "Goal", type: "text" },
      ],
      columns: [
        { key: "name", header: "Campaign", primary: true, value: (r) => r.name, render: (r) => r.name },
        { key: "startDate", header: "Start", value: (r) => r.startDate ?? "", render: (r) => formatDate(r.startDate) },
        { key: "goal", header: "Goal", value: (r) => r.goal ?? "", render: (r) => r.goal ?? "—" },
      ],
    }),
  ];
}
