"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartEmptyState, RechartsTooltip, useMounted } from "./chart-kit";

export interface BudgetActualRow {
  category: string;
  budget: number;
  actual: number;
}

/**
 * Horizontal budget-vs-actual. Budget is the faint track; actual is overlaid and turns
 * red when it exceeds the budget, green when under. Useful wherever a plan is compared to reality.
 */
export function BudgetVsActualChart({
  data,
  height,
  formatValue,
  onCategoryClick,
}: {
  data: BudgetActualRow[];
  height?: number;
  formatValue: (v: number | string | undefined) => string;
  onCategoryClick?: (category: string) => void;
}) {
  const mounted = useMounted();
  if (!mounted) return <div style={{ height: height ?? Math.max(160, data.length * 34 + 24) }} />;
  if (!data.length) return <ChartEmptyState label="No budgets to compare yet" />;

  const h = height ?? Math.max(160, data.length * 34 + 24);

  return (
    <div style={{ width: "100%", height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 8, bottom: 4, left: 4 }}
          barGap={2}
        >
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--fg-subtle)", fontSize: 11 }}
            tickFormatter={(v) => formatValue(v)}
          />
          <YAxis
            type="category"
            dataKey="category"
            width={120}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--fg-subtle)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "var(--bg-subtle)", opacity: 0.5 }}
            content={<RechartsTooltip format={(v) => formatValue(v)} />}
          />
          <Bar dataKey="budget" name="Budget" fill="var(--border)" radius={[0, 4, 4, 0]} maxBarSize={14} />
          <Bar
            dataKey="actual"
            name="Actual"
            radius={[0, 4, 4, 0]}
            maxBarSize={14}
            className="cursor-pointer"
            onClick={(d: any) => onCategoryClick?.(d?.category)}
          >
            {data.map((r, i) => (
              <Cell key={i} fill={r.actual > r.budget ? "var(--negative)" : "var(--positive)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
