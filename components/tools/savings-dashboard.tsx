"use client";

import * as React from "react";
import { Select } from "@/components/ui/field";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CategoryBreakdownChart, ChartContainer, ChartEmptyState, ChartLegend, ProgressChart, TrendChart } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Badge, CompactMetric } from "@/components/ui/card";
import { PinChartButton } from "@/lib/chart-widgets";
import { useI18n } from "@/lib/i18n";
import { useGoalLabel } from "@/lib/goal-label";
import { savingsBalanceTrend, savingsGoalRows, savingsMovementMonths, type SavingsGoalDashboardRow } from "@/lib/reporting/savings-dashboard";
import { useCollection } from "@/lib/store";
import { formatMoney, formatPercent } from "@/lib/money";
import { rows, type DataMap } from "@/lib/tools/shared";
import type { GoalMovement, SavingsGoal } from "@/lib/types";

type Range = 3 | 6 | 12 | "all";
const todayISO = () => {
  const date = new Date();
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
};
const statusTone = (status: SavingsGoalDashboardRow["status"]): "positive" | "warning" | "negative" | "neutral" =>
  status === "Goal Complete" || status === "Ahead of Schedule" ? "positive" : status === "Behind Schedule" ? "negative" : status === "On Track" ? "positive" : "neutral";

export function SavingsDashboard({ data, currency, onOpenTab }: { data: DataMap; currency: string; onOpenTab: (tab: string) => void }) {
  const { t } = useI18n();
  const goalLabel = useGoalLabel();
  const dateText = (date?: string) => date ? new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : t("No target date");
  const allGoals = rows<SavingsGoal>(data, "goals");
  const goals = allGoals.filter((goal) => !goal.deleted && (!goal.currency || goal.currency === currency));
  const movements = rows<GoalMovement>(data, "movements").filter((movement) => !movement.deleted && goals.some((goal) => goal.id === movement.goalId));
  const goalState = useCollection<SavingsGoal>("savings", "goals");
  const today = todayISO();
  const summaries = savingsGoalRows(goals, movements, today);
  // "" is the portfolio view. Never choose a goal by its current array position.
  const [selectedId, setSelectedId] = React.useState("");
  const [range, setRange] = React.useState<Range>(12);
  const [inspectedMonth, setInspectedMonth] = React.useState("");
  const [chartGoalId, setChartGoalId] = React.useState("");
  const [segmentMessage, setSegmentMessage] = React.useState("");
  const selected = summaries.find((row) => row.goal.id === selectedId);
  const totalSaved = summaries.reduce((sum, row) => sum + row.balance, 0);
  const totalTarget = summaries.reduce((sum, row) => sum + row.target, 0);
  const totalRemaining = summaries.reduce((sum, row) => sum + row.remaining, 0);
  const nextTarget = summaries.filter((row) => row.goal.targetDate && row.remaining > 0 && row.goal.targetDate >= today).sort((a, b) => (a.goal.targetDate ?? "").localeCompare(b.goal.targetDate ?? ""))[0];
  const combinedMonthlyNeeded = !summaries.length || summaries.some((row) => row.remaining > 0 && row.requiredMonthly == null)
    ? null
    : summaries.reduce((sum, row) => sum + (row.requiredMonthly ?? 0), 0);
  const monthsNeeded = selected?.requiredMonthly ?? combinedMonthlyNeeded;
  const emergency = summaries.find((row) => row.goal.kind === "emergency");
  const coverage = emergency?.goal.monthlyEssentials && emergency.goal.monthlyEssentials > 0
    ? emergency.balance / emergency.goal.monthlyEssentials
    : null;
  const coverageTarget = Number(emergency?.goal.coverageTargetMonths ?? 6);
  const trend = savingsBalanceTrend(goals, movements, range, today, chartGoalId || undefined);
  const monthlyActivity = savingsMovementMonths(movements, range, today, chartGoalId || undefined);
  const monthlyRequirement = chartGoalId
    ? summaries.find((row) => row.goal.id === chartGoalId)?.requiredMonthly ?? null
    : combinedMonthlyNeeded;
  const monthlyRequirementLabel = chartGoalId ? t("Selected goal's current requirement") : t("Combined current requirement");
  const actualMonthly = monthlyActivity;
  const selectedMovements = movements.filter((movement) => movement.goalId === selected?.goal.id).sort((a, b) => b.date.localeCompare(a.date));
  const targetDays = nextTarget?.goal.targetDate ? Math.max(0, Math.ceil((new Date(nextTarget.goal.targetDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000)) : null;
  const progressTarget = selected?.target ?? totalTarget;
  const progressBalance = selected?.balance ?? totalSaved;
  const visualSaved = Math.min(progressBalance, progressTarget);
  const visualRemaining = Math.max(0, progressTarget - visualSaved);
  const truePercent = progressTarget > 0 ? (progressBalance / progressTarget) * 100 : 0;
  const donutData = progressTarget > 0 ? [
    { id: "saved", name: t("Saved · {amount}", { amount: formatMoney(visualSaved, { currency }) }), value: visualSaved, color: "var(--positive)" },
    { id: "remaining", name: t("Remaining · {amount}", { amount: formatMoney(visualRemaining, { currency }) }), value: visualRemaining, color: "var(--bg-subtle)" },
  ].filter((item) => item.value > 0) : [];
  const activityTimeline = [
    ...selectedMovements.map((movement) => ({ id: movement.id, date: movement.date, title: movement.kind === "withdrawal" ? t("Withdrawal") : t("Contribution"), detail: movement.note || (selected ? goalLabel(selected.goal) : "") || t("Savings movement"), amount: movement.amount, kind: movement.kind })),
    ...summaries.filter((row) => row.goal.targetDate).map((row) => ({ id: "target:" + row.goal.id, date: row.goal.targetDate!, title: row.status === "Goal Complete" ? t("Goal milestone") : t("Target date"), detail: goalLabel(row.goal), amount: 0, kind: "target" })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-[16px] font-semibold">{t("Savings command center")}</h2><p className="text-[11px] text-fg-muted">{t("Balances use saved goals and their recorded movements.")}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" icon="plus" onClick={() => onOpenTab("movements")}>{t("Add contribution")}</Button>
          <Button size="sm" variant="secondary" icon="arrowDown" onClick={() => onOpenTab("movements")}>{t("Add withdrawal")}</Button>
          <Button size="sm" variant="secondary" icon="plus" onClick={() => onOpenTab("goals")}>{t("Create goal")}</Button>
        </div>
      </div>

      <div className="grid items-stretch gap-3 xl:grid-cols-2">
        <ChartContainer title={selected ? t("{name} · goal progress", { name: goalLabel(selected.goal) }) : t("All goals · combined progress")} subtitle={t("Saved and remaining amounts · target track is capped at 100%")} icon="chart-column">
          {summaries.length && progressTarget > 0 ? <>
            <div className="mb-1 flex items-center gap-2"><label htmlFor="savings-goal-progress-select" className="shrink-0 text-[11px] text-fg-muted">{t("Selected goal")}</label><Select id="savings-goal-progress-select" value={selected?.goal.id ?? "all-goals"} onChange={(event) => { setSelectedId(event.target.value === "all-goals" ? "" : event.target.value); setSegmentMessage(""); }} className="h-9 min-w-0 flex-1"><option value="all-goals">{t("All goals")}</option>{summaries.map((row) => <option key={row.goal.id} value={row.goal.id} data-raw="">{goalLabel(row.goal)}</option>)}</Select>{selected ? <Badge tone={statusTone(selected.status)}>{t(selected.status)}</Badge> : null}</div>
            <CategoryBreakdownChart data={donutData} formatValue={(value) => formatMoney(Number(value ?? 0), { currency })} centerValue={formatPercent(Math.min(100, Math.max(0, truePercent)), 0)} centerLabel={t("Saved {amount}", { amount: formatMoney(progressBalance, { currency }) })} onSliceClick={(id) => setSegmentMessage(id === "saved" ? t("Saved amount is the current balance from opening balance plus recorded contributions minus withdrawals.") : t("Remaining is the positive difference between this goal's target and current recorded balance."))} height={340} />
            {selected && selected.balance > selected.target ? <p className="text-center text-[11px] text-[var(--positive)]">{t("True funding: {percent} · {amount} above target", { percent: formatPercent(truePercent, 0), amount: formatMoney(selected.balance - selected.target, { currency }) })}</p> : null}
            {segmentMessage ? <p role="status" className="text-center text-[10px] text-fg-muted">{segmentMessage}</p> : null}
          </> : summaries.length ? <ChartEmptyState label={t("Set a positive target amount to display the goal donut.")} /> : <ChartEmptyState label={t("Create a savings goal to display its progress.")} />}
        </ChartContainer>
        <ChartContainer title={t("Savings summary")} subtitle={t("Combined totals and selected goal planning details")} icon="piggy-bank">
          <div className="grid auto-rows-fr grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="min-h-[94px] [&>div]:h-full"><CompactMetric label={t("Total saved")} value={formatMoney(totalSaved, { currency })} hint={t("{count} distinct goal allocations", { count: summaries.length })} tone="positive" /></div>
            <div className="min-h-[94px] [&>div]:h-full"><CompactMetric label={t("Combined goal targets")} value={formatMoney(totalTarget, { currency })} hint={t("Active tracked goals")} /></div>
            <div className="min-h-[94px] [&>div]:h-full"><CompactMetric label={t("Remaining to save")} value={formatMoney(totalRemaining, { currency })} hint={t("Sum of each goal's remaining amount")} /></div>
            <div className="min-h-[94px] [&>div]:h-full"><CompactMetric label={t("Monthly contribution needed")} value={monthsNeeded == null ? t("Set target date") : formatMoney(monthsNeeded, { currency })} hint={selected ? t("Selected goal · {name}", { name: goalLabel(selected.goal) }) : t("Select a dated goal")} /></div>
            <div className="min-h-[94px] [&>div]:h-full"><CompactMetric label={t("Emergency coverage")} value={coverage == null ? t("Set monthly essentials") : t("{months} months", { months: coverage.toFixed(1) })} hint={emergency ? goalLabel(emergency.goal) : t("Create an emergency fund goal")} /></div>
            <div className="min-h-[94px] [&>div]:h-full"><CompactMetric label={t("Next target date")} value={nextTarget?.goal.targetDate ? dateText(nextTarget.goal.targetDate) : t("No upcoming date")} hint={nextTarget ? goalLabel(nextTarget.goal) + (targetDays == null ? "" : t(" · {days} days", { days: targetDays })) : t("Add a target date")} /></div>
          </div>
        </ChartContainer>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartContainer title={t("Savings balance over time")} subtitle={chartGoalId ? t("{name} · opening balance plus dated movements", { name: (() => { const goal = goals.find((item) => item.id === chartGoalId); return goal ? goalLabel(goal) : ""; })() }) : t("All eligible goals · opening balances plus dated movements")} icon="trending-up" action={<div className="flex flex-wrap items-center justify-end gap-1"><Select aria-label={t("Filter savings trend by goal")} value={chartGoalId} onChange={(event) => setChartGoalId(event.target.value)} className="h-8 w-auto max-w-28"><option value="">{t("All goals")}</option>{goals.map((goal) => <option key={goal.id} value={goal.id} data-raw="">{goalLabel(goal)}</option>)}</Select><div className="flex gap-0.5">{([3, 6, 12, "all"] as const).map((item) => <button key={item} type="button" aria-pressed={range === item} onClick={() => setRange(item)} className={"rounded-full px-2 py-1 text-[9px] " + (range === item ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-fg-muted")}>{item === "all" ? t("All") : item + "M"}</button>)}</div><PinChartButton chartId="savings.balance-trend" title={t("Savings Balance Trend")} tool="savings" /></div>}>
          {trend.length ? <TrendChart data={trend} xKey="month" series={[{ key: "balance", name: t("Savings balance") }]} formatValue={(value) => formatMoney(Number(value ?? 0), { currency })} type="area" height={230} /> : <ChartEmptyState label={selected?.balance ? t("Current verified balance: {amount}. Dated movements are needed to show a historical trend.", { amount: formatMoney(selected.balance, { currency }) }) : t("Record dated contributions or withdrawals to build savings history.")} />}
        </ChartContainer>
        <ChartContainer title={t("Contributions vs withdrawals")} subtitle={t("Actual recorded movements by month · select a month for details")} icon="chart-column">
          {monthlyActivity.length && monthlyActivity.some((row) => row.contributions || row.withdrawals) ? <div className="h-[230px] min-w-0 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyActivity} margin={{ top: 8, right: 6, bottom: 0, left: 0 }} onClick={(event) => { const click = event as unknown as { activePayload?: { payload?: { key?: string } }[] }; const key = click?.activePayload?.[0]?.payload?.key; if (key) setInspectedMonth(key); }}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="month" tick={{ fill: "var(--fg-subtle)", fontSize: 9 }}/><YAxis width={60} tick={{ fill: "var(--fg-subtle)", fontSize: 9 }} tickFormatter={(value) => formatMoney(Number(value), { currency, maximumFractionDigits: 0 })}/><Tooltip formatter={(value) => formatMoney(Number(value), { currency })}/><Bar dataKey="contributions" name={t("Contributions")} fill="var(--positive)" radius={[4, 4, 0, 0]}/><Bar dataKey="withdrawals" name={t("Withdrawals")} fill="var(--negative)" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div> : <ChartEmptyState label={t("No dated contributions or withdrawals in this range.")} />}
          <ChartLegend items={[{ label: t("Contributions"), color: "var(--positive)" }, { label: t("Withdrawals"), color: "var(--negative)" }]} />
          {inspectedMonth ? <div className="mt-2 rounded-lg border border-line p-2"><div className="flex items-center justify-between"><p className="text-[10px] font-medium">{t("Activity · {month}", { month: inspectedMonth })}</p><button onClick={() => setInspectedMonth("")} className="text-[10px] underline">{t("Clear")}</button></div>{movements.filter((movement) => (!chartGoalId || movement.goalId === chartGoalId) && movement.date.startsWith(inspectedMonth)).map((movement) => <p key={movement.id} className="mt-1 text-[10px]">{dateText(movement.date)} · {(() => { const goal = goals.find((item) => item.id === movement.goalId); return goal ? goalLabel(goal) : ""; })()} · {t(movement.kind === "withdrawal" ? "Withdrawal" : "Contribution")} · {formatMoney(movement.amount, { currency })}</p>)}</div> : null}
        </ChartContainer>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartContainer title={t("Emergency fund coverage")} subtitle={t("Uses the designated emergency goal and its confirmed essential-expense baseline")} icon="shield">
          {emergency && coverage != null ? <><ProgressChart items={[{ id: emergency.goal.id, label: goalLabel(emergency.goal), value: coverage, target: coverageTarget, formatValue: (value) => t("{months} mo", { months: Number(value).toFixed(1) }), caption: t("{saved} saved ÷ {expenses} monthly essential expenses", { saved: formatMoney(emergency.balance, { currency }), expenses: formatMoney(emergency.goal.monthlyEssentials ?? 0, { currency }) }) }]} /><div className="mt-3 flex gap-2">{([3, 6, 12] as const).map((target) => <button key={target} type="button" aria-pressed={coverageTarget === target} onClick={() => void goalState.update(emergency.goal.id, { coverageTargetMonths: target })} className={"rounded-full border px-3 py-1.5 text-[10px] " + (coverageTarget === target ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-line")}>{t("{count} months", { count: target })}</button>)}</div><p className="mt-2 text-[10px] text-fg-subtle">{t("Coverage target is a planning choice. The selected preset is saved to this emergency goal.")}</p></> : <ChartEmptyState label={t("Set monthly essential expenses on an emergency goal to calculate coverage. No expense baseline is assumed.")} />}
        </ChartContainer>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartContainer title={t("Monthly required vs actual contributions")} subtitle={t("Current selected-goal requirement shown as a reference, not a claim about past plans")} icon="target">
          {actualMonthly.some((row) => row.contributions > 0) ? <div className="h-[230px] min-w-0 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={actualMonthly} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="month" tick={{ fill: "var(--fg-subtle)", fontSize: 9 }}/><YAxis width={60} tick={{ fill: "var(--fg-subtle)", fontSize: 9 }} tickFormatter={(value) => formatMoney(Number(value), { currency, maximumFractionDigits: 0 })}/><Tooltip formatter={(value) => formatMoney(Number(value), { currency })}/>{monthlyRequirement != null ? <ReferenceLine y={monthlyRequirement} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: t("Current required/month"), fill: "var(--fg-subtle)", fontSize: 9 }}/>: null}<Bar dataKey="contributions" name={t("Actual contribution")} fill="var(--positive)" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div> : <ChartEmptyState label={monthlyRequirement == null ? t("Set target dates to calculate the current monthly requirement; recorded contributions will appear here.") : t("{label}: {amount}/month. Record dated contributions for historical comparison.", { label: monthlyRequirementLabel, amount: formatMoney(monthlyRequirement, { currency }) })} />}
        </ChartContainer>
        <ChartContainer title={t("Contribution activity timeline")} subtitle={t("Recorded contributions, withdrawals, and goal target dates")} icon="calendar-range">
          {activityTimeline.length ? <div className="max-h-72 overflow-y-auto">{activityTimeline.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-0"><div className="min-w-0"><p className="truncate text-[11px] font-medium">{item.title} · {item.detail}</p><p className="text-[10px] text-fg-subtle">{dateText(item.date)}{item.kind === "target" ? t(" · milestone date") : ""}</p></div>{item.kind === "target" ? <Badge tone={item.date < today ? "neutral" : "warning"}>{item.date < today ? t("Past") : t("Planned")}</Badge> : <span className={"tnum text-[11px] " + (item.kind === "withdrawal" ? "text-[var(--negative)]" : "text-[var(--positive)]")}>{item.kind === "withdrawal" ? "−" : "+"}{formatMoney(item.amount, { currency })}</span>}</div>)}</div> : <ChartEmptyState label={t("No activity recorded yet. Add a contribution or withdrawal to start the timeline.")} />}
        </ChartContainer>
      </div>

      {selected ? <ChartContainer title={t("Goal details · {name}", { name: goalLabel(selected.goal) })} subtitle={t("Goal and movement records remain editable in the tables below.")} icon="piggy-bank" action={<Button size="sm" variant="secondary" onClick={() => onOpenTab("goals")}>{t("Edit goals")}</Button>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CompactMetric label={t("Current balance")} value={formatMoney(selected.balance, { currency })} hint={selected.goal.kind === "emergency" ? t("Emergency fund") : t("Savings goal")} />
          <CompactMetric label={t("Target")} value={formatMoney(selected.target, { currency })} hint={dateText(selected.goal.targetDate)} />
          <CompactMetric label={t("Monthly needed")} value={selected.requiredMonthly == null ? t("Target date needed") : formatMoney(selected.requiredMonthly, { currency })} hint={t(selected.status)} />
          <CompactMetric label={t("Projected completion")} value={selected.projectedCompletionDate ? dateText(selected.projectedCompletionDate) : t("Plan contribution to estimate")} hint={selected.goal.annualInterestRate ? t("Includes optional entered rate") : t("Assumes no interest")} />
        </div>
        <div className="mt-3"><ChartContainer title={t("Selected goal activity")} subtitle={t("Contribution and withdrawal history")} icon="chart-column">{selectedMovements.length ? <div className="max-h-48 overflow-y-auto">{selectedMovements.map((movement) => <div key={movement.id} className="flex justify-between border-b border-line py-2 text-[11px]"><span>{dateText(movement.date)} · {t(movement.kind === "withdrawal" ? "Withdrawal" : "Contribution")}</span><span className="tnum">{formatMoney(movement.amount, { currency })}</span></div>)}</div> : <ChartEmptyState label={t("No goal movements recorded.")} />}</ChartContainer></div>
      </ChartContainer> : null}
    </div>
  );
}
