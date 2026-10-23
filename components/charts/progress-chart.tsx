"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ChartEmptyState, chartColor } from "./chart-kit";

export interface ProgressItem {
  id: string;
  label: string;
  value: number;
  target: number;
  color?: string;
  formatValue?: (v: number) => string;
  caption?: string;
}

/**
 * Goal / target progress bars — savings goals, debt payoff, net-worth milestones.
 * Pure HTML (no canvas) so labels, percentages and overflow states stay crisp and accessible.
 */
export function ProgressChart({
  items,
  className,
}: {
  items: ProgressItem[];
  className?: string;
}) {
  if (!items.length) return <ChartEmptyState label="No goals to track yet" />;
  const fmt = (it: ProgressItem, v: number) => (it.formatValue ? it.formatValue(v) : String(Math.round(v)));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {items.map((it, i) => {
        const pct = it.target > 0 ? (it.value / it.target) * 100 : 0;
        const over = pct > 100;
        const color = it.color ?? chartColor(i);
        return (
          <div key={it.id}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-[12.5px] font-medium text-fg">{it.label}</span>
              <span className="tnum shrink-0 text-[12px] text-fg-muted">
                {fmt(it, it.value)} / {fmt(it, it.target)}
                <span className={cn("ml-1.5", over ? "text-[var(--positive)]" : "text-fg-subtle")}>
                  {Math.round(pct)}%
                </span>
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]"
              role="progressbar"
              aria-valuenow={Math.round(pct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={it.label}
            >
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${Math.min(100, pct)}%`, background: color }}
              />
            </div>
            {it.caption ? <p className="mt-1 text-[11px] text-fg-subtle">{it.caption}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
