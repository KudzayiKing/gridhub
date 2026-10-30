"use client";

import * as React from "react";
import Link from "next/link";
import { useDashboardData } from "@/lib/use-dashboard";
import { usePrefs } from "@/components/providers";
import { useActiveTools } from "@/lib/use-tools";
import { MetricCard, Card, EmptyState, Badge, SectionHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToolIcon } from "@/components/icons/tool-icons";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { AreaTrend, BarList } from "@/components/charts/trend";
import { CHART_WIDGETS, PinnedCharts, DashboardCustomizePanel } from "@/lib/chart-widgets";
import { PanelLeftOpenIcon, PanelRightOpenIcon } from "@/components/icons/panel-toggle-icons";
import { formatMoney, formatPercent } from "@/lib/money";
import { TOOL_MAP } from "@/lib/catalog";
import { useI18n } from "@/lib/i18n";
import { useGoalLabel } from "@/lib/goal-label";
import { monthLabel } from "@/components/charts/chart-kit";

/*
 * One list, two presentations. On phones these are a scrollable strip under the header — the
 * point of a quick action is that it is reachable without scrolling past the widgets, and the
 * card sat below "Needs your attention". On desktop the card stays, because there is room for
 * it and a horizontal strip of five pills next to a wide grid looks stranded.
 */
const QUICK_ACTIONS = [
  { href: "/app/money/budget", label: "Add expense", icon: "plus", tool: "budget" },
  { href: "/app/work/projects", label: "Add task", icon: "plus", tool: "projects" },
  { href: "/app/business/invoicing", label: "Create invoice", icon: "file-text", tool: "invoicing" },
  { href: "/app/life/nutrition", label: "Log a meal", icon: "utensils", tool: "nutrition" },
  { href: "/app/work/habits", label: "Complete a habit", icon: "circle-check", tool: "habits" },
] as const;

export default function DashboardPage() {
  const { t } = useI18n();
  const goalLabel = useGoalLabel();
  const { prefs, setPrefs, loading: prefsLoading } = usePrefs();
  const { active, loading: toolsLoading } = useActiveTools();
  const data = useDashboardData();
  const currency = prefs.currency || "USD";
  const dateLocale = ({ es: "es-ES", "zh-CN": "zh-CN", "pt-BR": "pt-BR", fr: "fr-FR", ar: "ar", ru: "ru-RU" } as const)[prefs.uiLanguage as "es" | "zh-CN" | "pt-BR" | "fr" | "ar" | "ru"] ?? "en-US";
  const [customizeOpen, setCustomizeOpen] = React.useState(false);
  const [showAllTools, setShowAllTools] = React.useState(false);

  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const activeTools = active.map((id) => TOOL_MAP[id]).filter(Boolean);
  const quickActions = QUICK_ACTIONS.filter((a) => data.has(a.tool));
  const kpiCandidates = [
    data.has("budget") && data.budget.transactionCount > 0 ? { id: "budget.net", label: "Net this month", value: formatMoney(data.budget.netCashFlow, { currency, signed: true }), hint: t("{value} savings rate", { value: formatPercent(data.budget.savingsRate) }), icon: "wallet", href: "/app/money/budget", tone: data.budget.netCashFlow >= 0 ? "positive" as const : "negative" as const } : null,
    data.has("savings") && data.savings.goals.length > 0 ? { id: "savings.total", label: "Saved", value: formatMoney(data.savings.balance, { currency }), hint: t("{value} of goals", { value: formatPercent(data.savings.progressPct) }), icon: "piggy-bank", href: "/app/money/savings", tone: "neutral" as const } : null,
    data.has("projects") && data.taskStats.total > 0 ? { id: "projects.open", label: "Tasks open", value: String(data.taskStats.remaining), hint: data.taskStats.overdue ? t("{count} overdue", { count: data.taskStats.overdue }) : t("Nothing overdue"), icon: "kanban", href: "/app/work/projects", tone: data.taskStats.overdue ? "warning" as const : "neutral" as const } : null,
    data.has("invoicing") && (data.invoicing.outstanding > 0 || data.invoicing.overdue.length > 0) ? { id: "invoicing.outstanding", label: "Outstanding", value: formatMoney(data.invoicing.outstanding, { currency }), hint: data.invoicing.overdue.length ? t("{count} overdue", { count: data.invoicing.overdue.length }) : t("All on time"), icon: "file-text", href: "/app/business/invoicing", tone: data.invoicing.overdueAmount > 0 ? "warning" as const : "neutral" as const } : null,
    data.has("habits") && data.habitStats.scheduledToday > 0 ? { id: "habits.today", label: "Habits today", value: `${data.habitStats.doneToday}/${data.habitStats.scheduledToday}`, hint: data.habitStats.bestStreak ? t("{count} day best streak", { count: data.habitStats.bestStreak }) : t("Start a streak"), icon: "circle-check", href: "/app/work/habits", tone: "neutral" as const } : null,
    data.has("content") && (data.content.scheduled > 0 || data.content.published > 0) ? { id: "content.scheduled", label: "Content scheduled", value: String(data.content.scheduled), hint: t("{count} published", { count: data.content.published }), icon: "calendar-range", href: "/app/work/content", tone: "neutral" as const } : null,
  ].filter((metric): metric is NonNullable<typeof metric> => Boolean(metric));
  const selectedKpis = (prefs.dashboardKpis ?? kpiCandidates.slice(0, 4).map((item) => item.id)).filter((id) => kpiCandidates.some((item) => item.id === id)).slice(0, 4);
  const kpis = selectedKpis.map((id) => kpiCandidates.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const toggleKpi = (id: string) => void setPrefs({ dashboardKpis: (selectedKpis.includes(id) ? selectedKpis.filter((item) => item !== id) : [...selectedKpis, id].slice(0, 4)) });
  const moveKpi = (id: string, direction: -1 | 1) => {
    const index = selectedKpis.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= selectedKpis.length) return;
    const next = [...selectedKpis];
    [next[index], next[target]] = [next[target], next[index]];
    void setPrefs({ dashboardKpis: next });
  };
  const restoreKpis = () => void setPrefs({ dashboardKpis: kpiCandidates.slice(0, 4).map((item) => item.id) });

  React.useEffect(() => {
    if (prefsLoading || toolsLoading || prefs.pinnedCharts !== undefined) return;
    const recommended = ["budget.monthly", "savings.goals", "sales.revenue", "projects.completion"]
      .map((id) => CHART_WIDGETS.find((widget) => widget.id === id))
      .filter((widget): widget is NonNullable<typeof widget> => Boolean(widget && active.includes(widget.tool)))
      .map((widget) => ({ id: widget.id, tool: widget.tool, chart: widget.id, title: widget.title }));
    void setPrefs({ pinnedCharts: recommended });
  }, [active, prefsLoading, prefs.pinnedCharts, setPrefs, toolsLoading]);

  if (!active.length) {
    return (
      <EmptyState
        icon="grid"
        title="Your workspace is ready"
        description="Choose the tools you need. Your dashboard builds itself around them — no setup wizard, no empty widgets for tools you don't use."
        action={
          <Button variant="primary" size="md" icon="explore" asChild>
            <Link href="/app/explore">Choose your tools</Link>
          </Button>
        }
        className="mt-10"
      />
    );
  }

  return (
    <div className="flex items-start gap-5">
    <main className={`flex min-w-0 flex-1 flex-col gap-5 transition-[margin] duration-300 ${customizeOpen ? "xl:mr-[380px]" : ""}`}>
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
            <p className="eyebrow mb-1">{new Date().toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="display-xl text-[26px] sm:text-[32px]">{t(greeting)}.</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            {activeTools.length} {t("tools in your workspace · everything organized.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setCustomizeOpen((value) => !value)} aria-expanded={customizeOpen} aria-controls="dashboard-customize-panel">
            {customizeOpen ? <PanelLeftOpenIcon size={16} /> : <PanelRightOpenIcon size={16} />}
            {t("Customize")}
          </Button>
          <Button variant="secondary" size="sm" icon="search" asChild>
            <Link href="/app/explore">{t("Explore tools")}</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.9fr)]">
        {/* Actionable attention stays beside the compact KPI cluster on desktop. */}
        <Card className="order-2 p-4 xl:order-1">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AnimatedIcon name="alert" size={16} className="text-fg-muted" trigger="hover" />
              <h2 className="text-[14px] font-semibold">{t("Needs your attention")}</h2>
            </div>
            {data.attention.length ? <Badge tone="warning">{data.attention.length}</Badge> : null}
          </div>

          {data.attention.length ? (
            <ul className="flex flex-col divide-y divide-[var(--border)]">
              {data.attention.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="press flex items-center gap-3 py-2.5 hover:opacity-80">
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line"
                      style={{ background: "var(--bg-subtle)" }}
                    >
                      <AnimatedIcon name={item.icon} size={14} trigger="hover" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{t(item.title)}</span>
                      <span className="block truncate text-[11.5px] text-fg-subtle">{t(item.detail)}</span>
                    </span>
                    <AnimatedIcon name="chevronRight" size={14} className="text-fg-subtle" trigger="none" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-1 py-3 text-center">
              <p className="text-[13px] font-medium"><AnimatedIcon name="check" size={16} className="mr-1 inline text-[var(--positive)]" trigger="hover" />{t("You're all caught up.")}</p>
            </div>
          )}
        </Card>

        <section className="order-1 rounded-2xl border border-line bg-[var(--surface)] p-3 xl:order-2" aria-label={t("Key metrics")}>
          <h2 className="mb-2 px-1 text-[12px] font-semibold text-fg-muted">{t("Key metrics")}</h2>
          {kpis.length ? <div className="grid grid-cols-2 gap-2">{kpis.map((kpi) => <Link key={kpi.label} href={kpi.href} className="block"><MetricCard label={kpi.label} value={kpi.value} hint={kpi.hint} icon={kpi.icon} tone={kpi.tone} className="h-full min-h-[100px] p-3 sm:p-3" /></Link>)}</div> : <p className="px-1 py-4 text-[12px] text-fg-muted">{t("Your key metrics will appear as you add records to your tools.")}</p>}
          {quickActions.length ? <div className="mt-3 border-t border-line pt-3"><h3 className="mb-2 px-1 text-[11px] font-medium text-fg-subtle">{t("Quick actions")}</h3><div className="flex flex-wrap gap-1.5">{quickActions.slice(0, 3).map((action) => <Button key={action.href} variant="secondary" size="sm" icon={action.icon} iconTrigger="hover" asChild><Link href={action.href}>{t(action.label)}</Link></Button>)}</div></div> : null}
        </section>
      </div>

      {/* Pinned insights are promoted directly below the KPI and attention summary. */}
      <PinnedCharts />
      {quickActions.length ? <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:-mx-5 sm:px-5 xl:hidden">{quickActions.slice(0, 4).map((action) => <Button key={action.href} variant="secondary" size="sm" icon={action.icon} iconTrigger="hover" asChild className="shrink-0"><Link href={action.href}>{t(action.label)}</Link></Button>)}</div> : null}

      {/* Insights */}
      {data.has("budget") && data.budget.transactionCount > 0 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="p-4 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold">{t("Spending trend")}</h2>
              <span className="text-[11px] text-fg-subtle">{t("This year · posted only")}</span>
            </div>
            <AreaTrend
              data={data.annual.monthly.map((m) => ({ label: monthLabel(m.month, prefs.uiLanguage), value: m.expenses }))}
              format={(n) => formatMoney(n, { currency })}
              ariaLabel="Monthly expenses"
            />
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 text-[14px] font-semibold">{t("Top categories")}</h2>
            <BarList
              items={data.budget.byCategory
                .filter((c) => c.kind === "expense")
                .slice(0, 5)
                .map((c) => ({ label: c.name, value: c.actual }))}
              format={(n) => formatMoney(n, { currency, maximumFractionDigits: 0 })}
            />
          </Card>
        </div>
      ) : null}

      {/* Recent activity and useful saved goals. */}
      <div className="grid gap-3 lg:grid-cols-2">
        {data.has("savings") && data.savings.goals.length ? (
          <Card className="flex h-full min-h-[260px] flex-col p-4 lg:min-h-[320px]">
            <h2 className="mb-3 text-[14px] font-semibold">{t("Savings goals")}</h2>
            <div className="mt-2 flex flex-1 flex-col justify-center gap-5">
              {data.savings.goals.slice(0, 3).map((goal) => (
                <div key={goal.id} className="flex items-center gap-4">
                  <span
                    role="img"
                    aria-label={t("{percent} percent saved", { percent: Math.round(goal.progressPct ?? 0) })}
                    className="h-20 w-20 shrink-0 rounded-full sm:h-28 sm:w-28 lg:h-36 lg:w-36 xl:h-40 xl:w-40"
                    style={{ background: `conic-gradient(var(--accent) ${Math.max(0, Math.min(100, goal.progressPct ?? 0))}%, var(--bg-subtle) 0)` }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium">{goalLabel(goal)}</p>
                    <p className="text-[11px] text-fg-subtle">
                      {t("{saved} of {target}", { saved: formatMoney(goal.balance, { currency }), target: formatMoney(goal.target, { currency }) })}
                    </p>
                  </div>
                  <span className="tnum text-[12px] text-fg-muted">{formatPercent(goal.progressPct)}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card className="dashboard-recent-activity min-w-0 p-4">
          <h2 className="mb-3 text-[14px] font-semibold">{t("Recent activity")}</h2>
          {data.recent.length ? (
            <ul className="flex flex-col gap-2">
              {data.recent.map((item) => (
                <li key={item.id}>
                  <Link href={item.href} className="press flex items-center gap-2.5 rounded-lg py-1 text-[12.5px] hover:bg-[var(--surface-hover)]">
                  <AnimatedIcon name={item.icon} size={14} className="text-fg-subtle" trigger="none" />
                  <span className="min-w-0 flex-1 truncate"><span className="block truncate">{item.title}</span><span className="block truncate text-[10.5px] text-fg-subtle">{(() => { const [kind, amount] = item.meta.split(" · "); return amount ? `${t(kind)} · ${formatMoney(Number(amount), { currency })}` : t(kind); })()}</span></span>
                  <span className="shrink-0 text-[11px] text-fg-subtle">{new Date(`${item.at}T12:00:00`).toLocaleDateString(dateLocale, { year: "numeric", month: "short", day: "numeric" })}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-[12px] text-fg-subtle">
              Activity appears as you add records. Nothing is simulated.
            </p>
          )}
        </Card>
      </div>

      {/* Compact tool launcher stays below dashboard insights. */}
      <div>
        <SectionHeading eyebrow="Your workspace" title="My tools" action={<div className="flex items-center gap-1"><Button variant="ghost" size="sm" onClick={() => setShowAllTools((value) => !value)}>{t(showAllTools ? "Show less" : "Show all")}</Button><Button variant="ghost" size="sm" iconRight="arrowRight" asChild><Link href="/app/tools">Manage</Link></Button></div>} />
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">{(showAllTools ? activeTools : activeTools.slice(0, 4)).map((tool) => <Link key={tool.id} href={tool.route} className="gp-card glass-sheen lift flex flex-col gap-2 p-3.5"><div className="flex items-start justify-between"><ToolIcon toolId={tool.id} size={18} trigger="hover" /><AnimatedIcon name="arrowUp" size={14} className="text-fg-subtle" trigger="none" /></div><div><p className="text-[13px] font-medium leading-tight">{t(tool.shortName)}</p><p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-fg-subtle">{t(tool.tagline)}</p></div></Link>)}</div>
      </div>
    </main>
    <DashboardCustomizePanel open={customizeOpen} onClose={() => setCustomizeOpen(false)} kpis={kpiCandidates.map(({ id, label }) => ({ id, label }))} selectedKpis={selectedKpis} onToggleKpi={toggleKpi} onMoveKpi={moveKpi} onRestoreKpis={restoreKpis} />
    </div>
  );
}
