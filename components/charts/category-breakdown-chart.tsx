"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartEmptyState, ChartLegend, RechartsTooltip, chartColor, useMounted } from "./chart-kit";

export interface CategorySlice {
  id: string;
  name: string;
  value: number;
  color?: string;
}

/**
 * Donut of spend by category. The center shows the total (or a custom value/label),
 * and clicking a slice lets the surrounding UI filter to that category. Colours fall back
 * to the themed categorical ramp when a slice doesn't supply its own.
 */
export function CategoryBreakdownChart({
  data,
  height = 240,
  formatValue,
  onSliceClick,
  centerLabel,
  centerValue,
  showLegend = true,
}: {
  data: CategorySlice[];
  height?: number;
  formatValue: (v: number | string | undefined) => string;
  onSliceClick?: (id: string) => void;
  centerLabel?: string;
  centerValue?: string;
  showLegend?: boolean;
}) {
  const mounted = useMounted();
  if (!mounted) return <div style={{ height }} />;
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0);
  if (!data.length || total <= 0) return <ChartEmptyState label="No spending to break down yet" />;

  const rows = data.map((d, i) => ({ ...d, fill: d.color ?? chartColor(i) }));

  return (
    <div>
      <div className="relative" style={{ width: "100%", height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={rows.length > 1 ? 2 : 0}
              stroke="var(--surface)"
              strokeWidth={2}
              onClick={(d: any) => onSliceClick?.(d?.payload?.id ?? d?.id)}
              className="cursor-pointer"
            >
              {rows.map((r, i) => (
                <Cell key={i} fill={r.fill} />
              ))}
            </Pie>
            <Tooltip content={<RechartsTooltip format={(v) => formatValue(v)} />} />
          </PieChart>
        </ResponsiveContainer>
        {(centerLabel || centerValue) && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {centerValue ? <span className="tnum text-[18px] font-semibold text-fg">{centerValue}</span> : null}
            {centerLabel ? <span className="text-[11px] text-fg-muted">{centerLabel}</span> : null}
          </div>
        )}
      </div>
      {showLegend ? (
        <ChartLegend items={rows.map((r) => ({ label: r.name, color: r.fill }))} />
      ) : null}
    </div>
  );
}
