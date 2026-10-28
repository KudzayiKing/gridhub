"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartEmptyState, RechartsTooltip, chartColor, useMounted } from "./chart-kit";
import { monthLabel } from "./chart-kit";
import { useI18n } from "@/lib/i18n";

export interface TrendSeries {
  key: string;
  name: string;
  color?: string;
}

/**
 * Multi-series time trend (line or soft-area). Used across tools for cash-flow, net worth,
 * balance, revenue, followers — anything that moves over time.
 */
export function TrendChart({
  data,
  xKey,
  series,
  height = 240,
  formatValue,
  type = "area",
  showGrid = true,
}: {
  data: Record<string, string | number | null | undefined>[];
  xKey: string;
  series: TrendSeries[];
  height?: number;
  formatValue: (v: number | string | undefined) => string;
  type?: "line" | "area";
  showGrid?: boolean;
}) {
  const { language, t } = useI18n();
  const mounted = useMounted();
  if (!mounted) return <div style={{ height }} />;
  if (!data.length || !series.length) return <ChartEmptyState label="No trend data yet" />;

  const axis = (
    <>
      <XAxis
        dataKey={xKey}
        tickFormatter={(value) => /^\d{4}-\d{2}$/.test(String(value)) ? monthLabel(String(value), language) : value}
        tickLine={false}
        axisLine={false}
        tick={{ fill: "var(--fg-subtle)", fontSize: 11 }}
        minTickGap={24}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={60}
        tick={{ fill: "var(--fg-subtle)", fontSize: 10 }}
        tickFormatter={(v) => formatValue(v)}
      />
    </>
  );

  return (
    <div className="min-w-0 w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {type === "area" ? (
          <AreaChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>
            {showGrid ? <CartesianGrid stroke="var(--border)" vertical={false} /> : null}
            {axis}
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              content={<RechartsTooltip format={(v) => formatValue(v)} />}
            />
            {series.map((s, i) => {
              const color = s.color ?? chartColor(i);
              return (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={t(s.name)}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.12}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              );
            })}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>
            {showGrid ? <CartesianGrid stroke="var(--border)" vertical={false} /> : null}
            {axis}
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              content={<RechartsTooltip format={(v) => formatValue(v)} />}
            />
            {series.map((s, i) => {
              const color = s.color ?? chartColor(i);
              return (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={t(s.name)}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              );
            })}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
