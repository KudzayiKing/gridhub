"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CategoryBreakdownChart, ChartContainer, ChartEmptyState, ChartLegend, ProgressChart, TrendChart } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Badge, CompactMetric } from "@/components/ui/card";
import { AnimatedIcon } from "@/components/icons/animated-icon";
import { PinChartButton } from "@/lib/chart-widgets";
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
const dateText = (date?: string) => date ? new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "No target date";
const statusTone = (status: SavingsGoalDashboardRow["status"]): "positive" | "warning" | "negative" | "neutral" =>
  status === "Goal Complete" || status === "Ahead of Schedule" ? "positive" : status === "Behind Schedule" ? "negative" : status === "On Track" ? "positive" : "neutral";

export function SavingsDashboard({ data, currency, onOpenTab }: { data: DataMap; currency: string; onOpenTab: (tab: string) => void }) {
  const allGoals = rows<SavingsGoal>(data, "goals");
  const goals = allGoals.filter((goal) => !goal.deleted && (!goal.currency || goal.currency === currency));
  const movements = rows<GoalMovement>(data, "movements").filter((movement) => !movement.deleted && goals.some((goal) => goal.id === movement.goalId));
  const goalState = useCollection<SavingsGoal>("savings", "goals");
  const today = todayISO();
  const summaries = savingsGoalRows(goals, movements, today);
  const [selectedId, setSelectedId] = React.useState(goals[0]?.id ?? "");
  const [range, setRange] = React.useState<Range>(12);
  const [sortBy, setSortBy] = React.useState<"progress" | "date" | "remaining" | "name">("date");
  const [inspectedMonth, setInspectedMonth] = React.useState("");
  const [chartGoalId, setChartGoalId] = React.useState("");
  const [segmentMessage, setSegmentMessage] = React.useState("");
  const selected = summaries.find((row) => row.goal.id === selectedId) ?? summaries[0];
  const totalSaved = summaries.reduce((sum, row) => sum + row.balance, 0);
  const totalTarget = summaries.reduce((sum, row) => sum + row.target, 0);
  const totalRemaining = summaries.reduce((sum, row) => sum + row.remaining, 0);
  const nextTarget = summaries.filter((row) => row.goal.targetDate && row.remaining > 0 && row.goal.targetDate >= today).sort((a, b) => (a.goal.targetDate ?? "").localeCompare(b.goal.targetDate ?? ""))[0];
  const monthsNeeded = selected?.requiredMonthly ?? null;
  const emergency = summaries.find((row) => row.goal.kind === "emergency");
  const coverage = emergency?.goal.monthlyEssentials && emergency.goal.monthlyEssentials > 0
    ? emergency.balance / emergency.goal.monthlyEssentials
    : null;
  const coverageTarget = Number(emergency?.goal.coverageTargetMonths ?? 6);
  const trend = savingsBalanceTrend(goals, movements, range, today, chartGoalId || undefined);
  const monthlyActivity = savingsMovementMonths(movements, range, today, chartGoalId || undefined);
  const monthlyRequirement = chartGoalId
    ? summaries.find((row) => row.goal.id === chartGoalId)?.requiredMonthly ?? null
    : !summaries.length || summaries.some((row) => row.remaining > 0 && row.requiredMonthly == null)
      ? null
      : summaries.reduce((sum, row) => sum + (row.requiredMonthly ?? 0), 0);
  const monthlyRequirementLabel = chartGoalId ? "Selected goal's current requirement" : "Combined current requirement";
  const actualMonthly = monthlyActivity;
  const selectedMovements = movements.filter((movement) => movement.goalId === selected?.goal.id).sort((a, b) => b.date.localeCompare(a.date));
  const targetDays = nextTarget?.goal.targetDate ? Math.max(0, Math.ceil((new Date(nextTarget.goal.targetDate + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000)) : null;
  const donutTarget = selected?.target ?? 0;
  const visualSaved = selected ? Math.min(selected.balance, donutTarget) : 0;
  const visualRemaining = selected ? Math.max(0, donutTarget - visualSaved) : 0;
  const truePercent = selected?.percent ?? 0;
  const donutData = selected && donutTarget > 0 ? [
    { id: "saved", name: "Saved · " + formatMoney(visualSaved, { currency }), value: visualSaved, color: "var(--positive)" },
    { id: "remaining", name: "Remaining · " + formatMoney(visualRemaining, { currency }), value: visualRemaining, color: "var(--bg-subtle)" },
  ].filter((item) => item.value > 0) : [];
  const compareRows = [...summaries].sort((a, b) => {
    if (sortBy === "progress") return (b.percent ?? 0) - (a.percent ?? 0);
    if (sortBy === "remaining") return a.remaining - b.remaining;
    if (sortBy === "name") return a.goal.name.localeCompare(b.goal.name);
    return (a.goal.targetDate ?? "9999").localeCompare(b.goal.targetDate ?? "9999");
  });
  const activityTimeline = [
    ...selectedMovements.map((movement) => ({ id: movement.id, date: movement.date, title: movement.kind === "withdrawal" ? "Withdrawal" : "Contribution", detail: movement.note || selected?.goal.name || "Savings movement", amount: movement.amount, kind: movement.kind })),
    ...summaries.filter((row) => row.goal.targetDate).map((row) => ({ id: "target:" + row.goal.id, date: row.goal.targetDate!, title: row.status === "Goal Complete" ? "Goal milestone" : "Target date", detail: row.goal.name, amount: 0, kind: "target" })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="text-[16px] font-semibold">Savings command center</h2><p className="text-[11px] text-fg-muted">Balances use saved goals and their recorded movements.</p></div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="primary" icon="plus" onClick={() => onOpenTab("movements")}>Add contribution</Button>
          <Button size="sm" variant="secondary" icon="arrowDown" onClick={() => onOpenTab("movements")}>Add withdrawal</Button>
          <Button size="sm" variant="secondary" icon="plus" onClick={() => onOpenTab("goals")}>Create goal</Button>
        </div>
      </div>

      <div className="grid auto-rows-fr grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <div className="min-h-[94px] [&>div]:h-full"><CompactMetric label="Total saved" value={formatMoney(totalSaved, { currency })} hint={summaries.length + " distinct goal allocations"} tone="positive" /></div>
        <div className="min-h-[94px] [&>div]:h-full"><CompactMetric label="Combined goal targets" value={formatMoney(totalTarget, { currency })} hint="Active tracked goals" /></div>
        <div className="min-h-[94px] [&>div]:h-full"><CompactMetric label="Remaining to save" value={formatMoney(totalRemaining, { currency })} hint="Sum of each goal's remaining amount" /></div>
        <div className="min-h-[94px] [&>div]:h-full"><CompactMetric label="Monthly contribution needed" value={monthsNeeded == null ? "Set target date" : formatMoney(monthsNeeded, { currency })} hint={selected ? "Selected goal · " + selected.goal.name : "Select a dated goal"} /></div>
        <div className="min-h-[94px] [&>div]:h-full"><CompactMetric label="Emergency coverage" value={coverage == null ? "Set monthly essentials" : coverage.toFixed(1) + " months"} hint={emergency ? emergency.goal.name : "Create an emergency fund goal"} /></div>
        <div className="min-h-[94px] [&>div]:h-full"><CompactMetric label="Next target date" value={nextTarget?.goal.targetDate ? dateText(nextTarget.goal.targetDate) : "No upcoming date"} hint={nextTarget ? nextTarget.goal.name + (targetDays == null ? "" : " · " + targetDays + " days") : "Add a target date"} /></div>
      </div>

      <div className="grid items-stretch gap-3 xl:grid-cols-2">
        <ChartContainer title="Goal progress" subtitle="Select a goal to inspect its savings and target trajectory" icon="piggy-bank">
          {summaries.length ? <div className="flex flex-col gap-2">
            {summaries.map((row) => <button key={row.goal.id} type="button" onClick={() => { setSelectedId(row.goal.id); setSegmentMessage(""); }} aria-pressed={selected?.goal.id === row.goal.id} className={"rounded-xl border p-3 text-left transition-colors " + (selected?.goal.id === row.goal.id ? "border-[var(--accent)] bg-[var(--accent-soft)]/30" : "border-line bg-[var(--bg-subtle)]/25 hover:bg-[var(--bg-subtle)]")}>
              <div className="flex items-start gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><AnimatedIcon name={row.goal.kind === "emergency" ? "shield" : "piggy-bank"} size={16} trigger="hover" /></span><div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-1"><span className="truncate text-[12px] font-semibold">{row.goal.name}</span><Badge tone={statusTone(row.status)}>{row.status}</Badge></div>
                <p className="mt-0.5 text-[10px] text-fg-muted">{formatMoney(row.balance, { currency })} / {formatMoney(row.target, { currency })} · {row.percent == null ? "No target" : formatPercent(row.percent, 0)}</p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]"><div className="h-full rounded-full bg-[var(--positive)]" style={{ width: Math.min(100, Math.max(0, row.percent ?? 0)) + "%" }} /></div>
                <p className="mt-1 text-[10px] text-fg-subtle">{row.goal.targetDate ? dateText(row.goal.targetDate) + (row.requiredMonthly == null ? "" : " · " + formatMoney(row.requiredMonthly, { currency }) + "/month") : "Add target date for a monthly plan"}{row.status === "Insufficient Data" ? " · Add a plan start date to compare trajectory" : ""}</p>
              </div></div>
            </button>)}
          </div> : <ChartEmptyState label="Create a savings goal to see progress here." />}
        </ChartContainer>
        <ChartContainer title={selected ? selected.goal.name + " · goal progress" : "Goal progress"} subtitle="Saved and remaining amounts · target track is capped at 100%" icon="chart-column">
          {summaries.length && donutTarget > 0 ? <>
            <label className="mb-1 flex items-center gap-2 text-[11px] text-fg-muted">Selected goal<select value={selected?.goal.id ?? ""} onChange={(event) => { setSelectedId(event.target.value); setSegmentMessage(""); }} className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-[var(--surface)] px-2 text-xs">{summaries.map((row) => <option key={row.goal.id} value={row.goal.id}>{row.goal.name}</option>)}</select></label>
            <CategoryBreakdownChart data={donutData} formatValue={(value) => formatMoney(Number(value ?? 0), { currency })} centerValue={formatPercent(Math.min(100, Math.max(0, truePercent)), 0)} centerLabel={"Saved " + formatMoney(selected?.balance ?? 0, { currency })} onSliceClick={(id) => setSegmentMessage(id === "saved" ? "Saved amount is the current balance from opening balance plus recorded contributions minus withdrawals." : "Remaining is the positive difference between this goal's target and current recorded balance.")} height={340} />
            {selected && selected.balance > selected.target ? <p className="text-center text-[11px] text-[var(--positive)]">True funding: {formatPercent(truePercent, 0)} · {formatMoney(selected.balance - selected.target, { currency })} above target</p> : null}
            {segmentMessage ? <p role="status" className="text-center text-[10px] text-fg-muted">{segmentMessage}</p> : null}
          </> : summaries.length ? <ChartEmptyState label="Set a positive target amount to display the goal donut." /> : <ChartEmptyState label="Create a savings goal to display its progress." />}
        </ChartContainer>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartContainer title="Savings balance over time" subtitle={chartGoalId ? goals.find((goal) => goal.id === chartGoalId)?.name + " · opening balance plus dated movements" : "All eligible goals · opening balances plus dated movements"} icon="trending-up" action={<div className="flex flex-wrap items-center justify-end gap-1"><select aria-label="Filter savings trend by goal" value={chartGoalId} onChange={(event) => setChartGoalId(event.target.value)} className="h-8 max-w-28 rounded-lg border border-line bg-[var(--surface)] px-1 text-[10px]"><option value="">All goals</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}</select><div className="flex gap-0.5">{([3, 6, 12, "all"] as const).map((item) => <button key={item} type="button" aria-pressed={range === item} onClick={() => setRange(item)} className={"rounded-full px-2 py-1 text-[9px] " + (range === item ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-fg-muted")}>{item === "all" ? "All" : item + "M"}</button>)}</div><PinChartButton chartId="savings.balance-trend" title="Savings Balance Trend" tool="savings" /></div>}>
          {trend.length ? <TrendChart data={trend} xKey="month" series={[{ key: "balance", name: "Savings balance" }]} formatValue={(value) => formatMoney(Number(value ?? 0), { currency })} type="area" height={230} /> : <ChartEmptyState label={selected?.balance ? "Current verified balance: " + formatMoney(selected.balance, { currency }) + ". Dated movements are needed to show a historical trend." : "Record dated contributions or withdrawals to build savings history."} />}
        </ChartContainer>
        <ChartContainer title="Contributions vs withdrawals" subtitle="Actual recorded movements by month · select a month for details" icon="chart-column">
          {monthlyActivity.length && monthlyActivity.some((row) => row.contributions || row.withdrawals) ? <div className="h-[230px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyActivity} onClick={(event) => { const click = event as unknown as { activePayload?: { payload?: { key?: string } }[] }; const key = click?.activePayload?.[0]?.payload?.key; if (key) setInspectedMonth(key); }}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="month" tick={{ fill: "var(--fg-subtle)", fontSize: 9 }}/><YAxis tick={{ fill: "var(--fg-subtle)", fontSize: 9 }} tickFormatter={(value) => formatMoney(Number(value), { currency, maximumFractionDigits: 0 })}/><Tooltip formatter={(value) => formatMoney(Number(value), { currency })}/><Bar dataKey="contributions" name="Contributions" fill="var(--positive)" radius={[4, 4, 0, 0]}/><Bar dataKey="withdrawals" name="Withdrawals" fill="var(--negative)" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div> : <ChartEmptyState label="No dated contributions or withdrawals in this range." />}
          <ChartLegend items={[{ label: "Contributions", color: "var(--positive)" }, { label: "Withdrawals", color: "var(--negative)" }]} />
          {inspectedMonth ? <div className="mt-2 rounded-lg border border-line p-2"><div className="flex items-center justify-between"><p className="text-[10px] font-medium">Activity · {inspectedMonth}</p><button onClick={() => setInspectedMonth("")} className="text-[10px] underline">Clear</button></div>{movements.filter((movement) => (!chartGoalId || movement.goalId === chartGoalId) && movement.date.startsWith(inspectedMonth)).map((movement) => <p key={movement.id} className="mt-1 text-[10px]">{dateText(movement.date)} · {goals.find((goal) => goal.id === movement.goalId)?.name} · {movement.kind} · {formatMoney(movement.amount, { currency })}</p>)}</div> : null}
        </ChartContainer>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartContainer title="Goal progress comparison" subtitle="Same goal balances used by the hero donut" icon="target" action={<label className="flex items-center gap-1 text-[10px] text-fg-muted">Sort<select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} className="h-8 rounded-lg border border-line bg-[var(--surface)] px-1"><option value="date">Target date</option><option value="progress">Progress</option><option value="remaining">Amount remaining</option><option value="name">Name</option></select></label>}>
          <div className="flex flex-col gap-2">{compareRows.length ? compareRows.map((row) => <button key={row.goal.id} onClick={() => setSelectedId(row.goal.id)} className="rounded-xl border border-line p-2.5 text-left hover:bg-[var(--bg-subtle)]"><div className="flex justify-between gap-2"><span className="truncate text-[11px] font-medium">{row.goal.name}</span><span className="tnum text-[10px]">{row.percent == null ? "No target" : formatPercent(row.percent, 0)}</span></div><div className="my-1 h-1.5 rounded-full bg-[var(--bg-subtle)]"><div className="h-1.5 rounded-full bg-[var(--positive)]" style={{ width: Math.min(100, Math.max(0, row.percent ?? 0)) + "%" }}/></div><p className="text-[10px] text-fg-subtle">{formatMoney(row.balance, { currency })} saved · {formatMoney(row.remaining, { currency })} remaining · target {formatMoney(row.target, { currency })}</p></button>) : <ChartEmptyState label="Create goals to compare progress." />}</div>
        </ChartContainer>
        <ChartContainer title="Emergency fund coverage" subtitle="Uses the designated emergency goal and its confirmed essential-expense baseline" icon="shield">
          {emergency && coverage != null ? <><ProgressChart items={[{ id: emergency.goal.id, label: emergency.goal.name, value: coverage, target: coverageTarget, formatValue: (value) => Number(value).toFixed(1) + " mo", caption: formatMoney(emergency.balance, { currency }) + " saved ÷ " + formatMoney(emergency.goal.monthlyEssentials ?? 0, { currency }) + " monthly essential expenses" }]} /><div className="mt-3 flex gap-2">{([3, 6, 12] as const).map((target) => <button key={target} type="button" aria-pressed={coverageTarget === target} onClick={() => void goalState.update(emergency.goal.id, { coverageTargetMonths: target })} className={"rounded-full border px-3 py-1.5 text-[10px] " + (coverageTarget === target ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-line")}>{target} months</button>)}</div><p className="mt-2 text-[10px] text-fg-subtle">Coverage target is a planning choice. The selected preset is saved to this emergency goal.</p></> : <ChartEmptyState label="Set monthly essential expenses on an emergency goal to calculate coverage. No expense baseline is assumed." />}
        </ChartContainer>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartContainer title="Monthly required vs actual contributions" subtitle="Current selected-goal requirement shown as a reference, not a claim about past plans" icon="target">
          {actualMonthly.some((row) => row.contributions > 0) ? <div className="h-[230px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={actualMonthly}><CartesianGrid stroke="var(--border)" vertical={false}/><XAxis dataKey="month" tick={{ fill: "var(--fg-subtle)", fontSize: 9 }}/><YAxis tick={{ fill: "var(--fg-subtle)", fontSize: 9 }} tickFormatter={(value) => formatMoney(Number(value), { currency, maximumFractionDigits: 0 })}/><Tooltip formatter={(value) => formatMoney(Number(value), { currency })}/>{monthlyRequirement != null ? <ReferenceLine y={monthlyRequirement} stroke="var(--warning)" strokeDasharray="4 4" label={{ value: "Current required/month", fill: "var(--fg-subtle)", fontSize: 9 }}/>: null}<Bar dataKey="contributions" name="Actual contribution" fill="var(--positive)" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div> : <ChartEmptyState label={monthlyRequirement == null ? "Set target dates to calculate the current monthly requirement; recorded contributions will appear here." : monthlyRequirementLabel + ": " + formatMoney(monthlyRequirement, { currency }) + "/month. Record dated contributions for historical comparison."} />}
        </ChartContainer>
        <ChartContainer title="Contribution activity timeline" subtitle="Recorded contributions, withdrawals, and goal target dates" icon="calendar-range">
          {activityTimeline.length ? <div className="max-h-72 overflow-y-auto">{activityTimeline.map((item) => <div key={item.id} className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-0"><div className="min-w-0"><p className="truncate text-[11px] font-medium">{item.title} · {item.detail}</p><p className="text-[10px] text-fg-subtle">{dateText(item.date)}{item.kind === "target" ? " · milestone date" : ""}</p></div>{item.kind === "target" ? <Badge tone={item.date < today ? "neutral" : "warning"}>{item.date < today ? "Past" : "Planned"}</Badge> : <span className={"tnum text-[11px] " + (item.kind === "withdrawal" ? "text-[var(--negative)]" : "text-[var(--positive)]")}>{item.kind === "withdrawal" ? "−" : "+"}{formatMoney(item.amount, { currency })}</span>}</div>)}</div> : <ChartEmptyState label="No activity recorded yet. Add a contribution or withdrawal to start the timeline." />}
        </ChartContainer>
      </div>

      {selected ? <ChartContainer title={"Goal details · " + selected.goal.name} subtitle="Goal and movement records remain editable in the tables below." icon="piggy-bank" action={<Button size="sm" variant="secondary" onClick={() => onOpenTab("goals")}>Edit goals</Button>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CompactMetric label="Current balance" value={formatMoney(selected.balance, { currency })} hint={selected.goal.kind === "emergency" ? "Emergency fund" : "Savings goal"} />
          <CompactMetric label="Target" value={formatMoney(selected.target, { currency })} hint={dateText(selected.goal.targetDate)} />
          <CompactMetric label="Monthly needed" value={selected.requiredMonthly == null ? "Target date needed" : formatMoney(selected.requiredMonthly, { currency })} hint={selected.status} />
          <CompactMetric label="Projected completion" value={selected.projectedCompletionDate ? dateText(selected.projectedCompletionDate) : "Plan contribution to estimate"} hint={selected.goal.annualInterestRate ? "Includes optional entered rate" : "Assumes no interest"} />
        </div>
        <div className="mt-3"><ChartContainer title="Selected goal activity" subtitle="Contribution and withdrawal history" icon="chart-column">{selectedMovements.length ? <div className="max-h-48 overflow-y-auto">{selectedMovements.map((movement) => <div key={movement.id} className="flex justify-between border-b border-line py-2 text-[11px]"><span>{dateText(movement.date)} · {movement.kind}</span><span className="tnum">{formatMoney(movement.amount, { currency })}</span></div>)}</div> : <ChartEmptyState label="No goal movements recorded." />}</ChartContainer></div>
      </ChartContainer> : null}
    </div>
  );
}

