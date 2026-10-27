"use client";

import * as React from "react";
import {
  Area,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartEmptyState, RechartsTooltip, useMounted } from "./chart-kit";

export interface ForecastPoint {
  /** x category / period label. */
  x: string;
  /** Observed value (history only). */
  value?: number;
  /** Forecasted value (future only). */
  forecast?: number;
  /** Lower bound of confidence band (optional). */
  low?: number;
  /** Upper bound of confidence band (optional). */
  high?: number;
}

/**
 * History (solid) + forecast (dashed) line with optional confidence band.
 * Drives the Annual Budget net-cash-flow projection and any "what's next" panel.
 */
export function ForecastChart({
  data,
  height = 240,
  formatValue,
  historyName = "Actual",
  forecastName = "Forecast",
}: {
  data: ForecastPoint[];
  height?: number;
  formatValue: (v: number | string | undefined) => string;
  historyName?: string;
  forecastName?: string;
}) {
  const mounted = useMounted();
  if (!mounted) return <div style={{ height }} />;
  if (!data.length) return <ChartEmptyState label="Not enough history to forecast" />;

  const rows = data.map((d) => ({
    x: d.x,
    value: d.value ?? null,
    forecast: d.forecast ?? null,
    band: d.low != null && d.high != null ? (d.low + d.high) / 2 : null,
    low: d.low ?? null,
    high: d.high ?? null,
  }));

  return (
    <div className="min-w-0 w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 6, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="x"
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
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            content={<RechartsTooltip format={(v) => formatValue(v)} />}
          />
          <Area
            dataKey="band"
            name="Range"
            stroke="none"
            fill="var(--accent)"
            fillOpacity={0.12}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            dataKey="value"
            name={historyName}
            stroke="var(--positive)"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          <Line
            dataKey="forecast"
            name={forecastName}
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
