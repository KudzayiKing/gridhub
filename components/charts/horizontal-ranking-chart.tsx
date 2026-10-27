"use client";

import * as React from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartEmptyState, RechartsTooltip, chartColor, useMounted } from "./chart-kit";

export interface RankingItem {
  id: string;
  label: string;
  value: number;
  color?: string;
}

/**
 * Ranked horizontal bars — a "top N" list (top categories, top products, top debtors).
 * Sorted descending before render so the biggest item sits on top.
 */
export function HorizontalRankingChart({
  data,
  height,
  formatValue,
  maxItems,
  onItemClick,
}: {
  data: RankingItem[];
  height?: number;
  formatValue: (v: number | string | undefined) => string;
  maxItems?: number;
  onItemClick?: (id: string) => void;
}) {
  const mounted = useMounted();
  const source = React.useMemo(
    () => (maxItems ? [...data].sort((a, b) => b.value - a.value).slice(0, maxItems) : [...data].sort((a, b) => b.value - a.value)),
    [data, maxItems],
  );
  if (!mounted) return <div style={{ height: height ?? Math.max(160, source.length * 34 + 24) }} />;
  if (!source.length) return <ChartEmptyState label="Nothing to rank yet" />;

  const h = height ?? Math.max(160, source.length * 34 + 24);

  return (
    <div className="min-w-0 w-full" style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={source} margin={{ top: 4, right: 8, bottom: 4, left: 4 }}>
          <XAxis type="number" hide tickFormatter={(v) => formatValue(v)} />
          <YAxis
            type="category"
            dataKey="label"
            width={130}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--fg-subtle)", fontSize: 11 }}
          />
          <Tooltip
            cursor={{ fill: "var(--bg-subtle)", opacity: 0.5 }}
            content={<RechartsTooltip format={(v) => formatValue(v)} />}
          />
          <Bar
            dataKey="value"
            name="Value"
            radius={[0, 4, 4, 0]}
            maxBarSize={18}
            className="cursor-pointer"
            onClick={(d: any) => onItemClick?.(d?.id)}
          >
            {source.map((r, i) => (
              <Cell key={i} fill={r.color ?? chartColor(i)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
