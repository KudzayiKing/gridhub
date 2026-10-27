"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartEmptyState, ChartLegend, RechartsTooltip, chartColor, useMounted } from "./chart-kit";

export interface StackSeries {
  key: string;
  name: string;
  color?: string;
}

/**
 * Stacked bars — e.g. income composition, spend by category over time, channel mix.
 * Each series stacks on the same x bucket; colours come from the themed ramp.
 */
export function StackedBarChart({
  data,
  xKey,
  series,
  height = 260,
  formatValue,
  showLegend = true,
}: {
  data: Record<string, any>[];
  xKey: string;
  series: StackSeries[];
  height?: number;
  formatValue: (v: number | string | undefined) => string;
  showLegend?: boolean;
}) {
  const mounted = useMounted();
  if (!mounted) return <div style={{ height }} />;
  if (!data.length || !series.length) return <ChartEmptyState label="No data to stack yet" />;

  return (
    <div>
      <div className="min-w-0" style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--fg-subtle)", fontSize: 11 }}
              interval={0}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={60}
              tick={{ fill: "var(--fg-subtle)", fontSize: 10 }}
              tickFormatter={(v) => formatValue(v)}
            />
            <Tooltip
              cursor={{ fill: "var(--bg-subtle)", opacity: 0.5 }}
              content={<RechartsTooltip format={(v) => formatValue(v)} />}
            />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.name} stackId="a" fill={s.color ?? chartColor(i)} maxBarSize={36} radius={[2, 2, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {showLegend ? (
        <ChartLegend items={series.map((s, i) => ({ label: s.name, color: s.color ?? chartColor(i) }))} />
      ) : null}
    </div>
  );
}
