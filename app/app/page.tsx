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
import { AreaTrend, BarList, ProgressRing } from "@/components/charts/trend";
import { PinnedCharts, AddChartMenu } from "@/lib/chart-widgets";
import { formatMoney, formatPercent } from "@/lib/money";
import { TOOL_MAP } from "@/lib/catalog";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

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
  const { prefs } = usePrefs();
  const { active } = useActiveTools();
  const data = useDashboardData();
  const currency = prefs.currency || "USD";

  const greeting = React.useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const activeTools = active.map((id) => TOOL_MAP[id]).filter(Boolean);
  const quickActions = QUICK_ACTIONS.filter((a) => data.has(a.tool));

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
    <div className="flex flex-col gap-5">
      {/* Quick actions — mobile strip */}
      {quickActions.length ? (
        <div className="no-scrollbar -mx-3 -mb-1 flex gap-2.5 overflow-x-auto px-3 pb-1.5 sm:-mx-5 sm:px-5 lg:hidden">
          {quickActions.map((action) => (
            <Button
              key={action.href}
              variant="secondary"
              size="sm"
              icon={action.icon}
              iconTrigger="hover"
              asChild
              className="shrink-0"
            >
              <Link href={action.href}>{action.label}</Link>
            </Button>
          ))}
        </div>
      ) : null}

      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
            <p className="eyebrow mb-1">{new Date().toLocaleDateString(prefs.uiLanguage === "zh-CN" ? "zh-CN" : prefs.uiLanguage === "pt-BR" ? "pt-BR" : prefs.uiLanguage === "es" ? "es" : prefs.uiLanguage === "fr" ? "fr" : prefs.uiLanguage === "ar" ? "ar" : prefs.uiLanguage === "ru" ? "ru" : "en-US", { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1 className="display-xl text-[26px] sm:text-[32px]">{t(greeting)}.</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            {activeTools.length} {t("tools in your workspace · everything organized.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon="search" asChild>
            <Link href="/app/explore">Explore tools</Link>
          </Button>
        </div>
      </div>

      {/* Vital metrics */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        {data.has("budget") ? (
          <MetricCard
            label="Net this month"
            value={formatMoney(data.budget.netCashFlow, { currency, signed: true })}
            hint={t("{value} savings rate", { value: formatPercent(data.budget.savingsRate) })}
            icon="wallet"
            tone={data.budget.netCashFlow >= 0 ? "positive" : "negative"}
          />
        ) : null}
        {data.has("savings") ? (
          <MetricCard
            label="Saved"
            value={formatMoney(data.savings.balance, { currency })}
            hint={t("{value} of goals", { value: formatPercent(data.savings.progressPct) })}
            icon="piggy-bank"
          />
        ) : null}
        {data.has("projects") ? (
          <MetricCard
            label="Tasks open"
            value={String(data.taskStats.remaining)}
            hint={data.taskStats.overdue ? t("{count} overdue", { count: data.taskStats.overdue }) : t("Nothing overdue")}
            icon="kanban"
            tone={data.taskStats.overdue ? "warning" : "neutral"}
          />
        ) : null}
        {data.has("invoicing") ? (
          <MetricCard
            label="Outstanding"
            value={formatMoney(data.invoicing.outstanding, { currency })}
            hint={data.invoicing.overdue.length ? t("{count} overdue", { count: data.invoicing.overdue.length }) : t("All on time")}
            icon="file-text"
            tone={data.invoicing.overdueAmount > 0 ? "warning" : "neutral"}
          />
        ) : null}
        {data.has("habits") ? (
          <MetricCard
            label="Habits today"
            value={`${data.habitStats.doneToday}/${data.habitStats.scheduledToday}`}
            hint={data.habitStats.bestStreak ? t("{count} day best streak", { count: data.habitStats.bestStreak }) : t("Start a streak")}
            icon="circle-check"
          />
        ) : null}
        {data.has("nutrition") ? (
          <MetricCard
            label="Calories today"
            value={String(Math.round(data.todayNutrition.kcal))}
            hint={t("{count} g protein", { count: data.todayNutrition.protein })}
            icon="utensils"
          />
        ) : null}
        {data.has("content") ? (
          <MetricCard
            label="Content scheduled"
            value={String(data.content.scheduled)}
            hint={t("{count} published", { count: data.content.published })}
            icon="calendar-range"
          />
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Attention */}
        <Card className="p-4 lg:col-span-2">
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
            <div className="flex flex-col items-center gap-1 py-8 text-center">
              <AnimatedIcon name="check" size={22} className="text-[var(--positive)]" trigger="hover" />
              <p className="text-[13px] font-medium">{t("Nothing needs you right now.")}</p>
              <p className="text-[11.5px] text-fg-subtle">{t("Bills, invoices, deadlines and sync issues appear here.")}</p>
            </div>
          )}
        </Card>

        {/* Quick actions — desktop card. The phone equivalent is the strip at the top. */}
        <Card className="hidden p-4 lg:block">
          <h2 className="mb-3 text-[14px] font-semibold">{t("Quick actions")}</h2>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Button key={action.href} variant="secondary" size="sm" icon={action.icon} iconTrigger="hover" asChild>
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ))}
            {!quickActions.length ? (
              <p className="py-2 text-[12px] text-fg-subtle">Quick actions appear for the tools you activate.</p>
            ) : null}
          </div>
        </Card>
      </div>

      {/* My tools */}
      <div>
        <SectionHeading
          eyebrow="Your workspace"
          title="My tools"
          action={
            <Button variant="ghost" size="sm" iconRight="arrowRight" asChild>
              <Link href="/app/tools">Manage</Link>
            </Button>
          }
        />
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {activeTools.map((tool) => (
            <Link
              key={tool.id}
              href={tool.route}
              className="gp-card glass-sheen lift flex flex-col gap-2 p-3.5"
            >
              <div className="flex items-start justify-between">
                <ToolIcon toolId={tool.id} size={18} trigger="hover" />
                <AnimatedIcon name="arrowUp" size={14} className="text-fg-subtle" trigger="none" />
              </div>
              <div>
                <p className="text-[13px] font-medium leading-tight">{tool.shortName}</p>
                <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-fg-subtle">{tool.tagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Pinned charts (spec #20) — unified dashboard, persisted per device */}
      <div className="flex flex-col gap-3">
        <SectionHeading
          eyebrow="Customise"
          title="Your pinned charts"
          action={
            <Button variant="ghost" size="sm" iconRight="arrowRight" asChild>
              <Link href="/app/tools">Manage tools</Link>
            </Button>
          }
        />
        <AddChartMenu />
        <PinnedCharts />
      </div>

      {/* Insights */}
      {data.has("budget") && data.budget.transactionCount > 0 ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <Card className="p-4 lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold">Spending trend</h2>
              <span className="text-[11px] text-fg-subtle">This year · posted only</span>
            </div>
            <AreaTrend
              data={data.annual.monthly.map((m) => ({ label: m.month.slice(5), value: m.expenses }))}
              format={(n) => formatMoney(n, { currency })}
              ariaLabel="Monthly expenses"
            />
          </Card>
          <Card className="p-4">
            <h2 className="mb-3 text-[14px] font-semibold">Top categories</h2>
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

      {/* Savings + recent */}
      <div className="grid gap-3 lg:grid-cols-2">
        {data.has("savings") && data.savings.goals.length ? (
          <Card className="p-4">
            <h2 className="mb-3 text-[14px] font-semibold">Savings goals</h2>
            <div className="flex flex-col gap-3">
              {data.savings.goals.slice(0, 3).map((goal) => (
                <div key={goal.id} className="flex items-center gap-3">
                  <ProgressRing value={goal.progressPct} size={38} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium">{goal.name}</p>
                    <p className="text-[11px] text-fg-subtle">
                      {formatMoney(goal.balance, { currency })} of {formatMoney(goal.target, { currency })}
                    </p>
                  </div>
                  <span className="tnum text-[12px] text-fg-muted">{formatPercent(goal.progressPct)}</span>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card className="p-4">
          <h2 className="mb-3 text-[14px] font-semibold">Recent activity</h2>
          {data.recent.length ? (
            <ul className="flex flex-col gap-2">
              {data.recent.map((item) => (
                <li key={item.id} className="flex items-center gap-2.5 text-[12.5px]">
                  <AnimatedIcon name={item.icon} size={14} className="text-fg-subtle" trigger="none" />
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  <span className="shrink-0 text-[11px] text-fg-subtle">{formatDate(item.at)}</span>
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
    </div>
  );
}
