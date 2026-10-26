"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartEmptyState, ChartLegend, RechartsTooltip, useMounted, monthLabel } from "./chart-kit";

export interface MonthlyPointInput {
  /** "YYYY-MM" or "YYYY". */
  month: string;
  income: number;
  expenses: number;
}

/**
 * Grouped bars: income vs expenses across the months of a year. Clicking a bar selects that
 * month so the rest of the screen can drill in — a single source of truth (budgetSummary)
 * feeds both the bars and the detail, so the numbers always agree.
 */
export function MonthlyComparisonChart({
  data,
  height = 240,
  formatValue,
  onMonthClick,
  selectedMonth,
}: {
  data: MonthlyPointInput[];
  height?: number;
  formatValue: (v: number | string | undefined) => string;
  onMonthClick?: (month: string) => void;
  selectedMonth?: string | null;
}) {
  const mounted = useMounted();
  if (!mounted) return <div style={{ height }} />;
  if (!data.length) return <ChartEmptyState label="No monthly data yet" />;

  const rows = data.map((d) => ({
    month: d.month,
    label: monthLabel(d.month),
    income: d.income,
    expenses: d.expenses,
  }));

  return (
    <div>
      <div style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barGap={2}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--fg-subtle)", fontSize: 11 }}
            interval={0}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tick={{ fill: "var(--fg-subtle)", fontSize: 11 }}
            tickFormatter={(v) => formatValue(v)}
          />
          <Tooltip
            cursor={{ fill: "var(--bg-subtle)", opacity: 0.5 }}
            content={<RechartsTooltip format={(v) => formatValue(v)} />}
          />
          <Bar
            dataKey="income"
            name="Income"
            fill="var(--positive)"
            radius={[3, 3, 0, 0]}
            maxBarSize={18}
            onClick={(datum) => onMonthClick?.(datum?.payload?.month)}
            className="cursor-pointer"
          />
          <Bar
            dataKey="expenses"
            name="Expenses"
            fill="var(--chart-3)"
            radius={[3, 3, 0, 0]}
            maxBarSize={18}
            onClick={(datum) => onMonthClick?.(datum?.payload?.month)}
            className="cursor-pointer"
          >
            {rows.map((r, i) => (
              <Cell key={i} fill={selectedMonth === r.month ? "var(--accent)" : "var(--chart-3)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
      <ChartLegend items={[
        { label: "Income", color: "var(--positive)" },
        { label: "Expenses", color: "var(--chart-3)" },
      ]} />
    </div>
  );
}
