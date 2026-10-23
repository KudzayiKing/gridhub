"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface Point {
  label: string;
  value: number;
}

/**
 * Lightweight SVG area chart. Hand-rolled so it renders identically on the server and
 * the client (no chart-library hydration mismatch) and stays crisp on small screens.
 */
export function AreaTrend({
  data,
  height = 140,
  format = (n: number) => String(Math.round(n)),
  tone = "accent",
  className,
  ariaLabel = "Trend chart",
}: {
  data: Point[];
  height?: number;
  format?: (n: number) => string;
  tone?: "accent" | "positive" | "negative";
  className?: string;
  ariaLabel?: string;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  // Hooks must run unconditionally, so the gradient id is resolved before the empty-state
  // early return below. Calling useId() after it would break the hook order.
  const gradientId = React.useId().replace(/:/g, "");
  const width = 640;
  const pad = { top: 10, right: 6, bottom: 20, left: 6 };

  if (!data.length) {
    return (
      <div
        className={cn("flex items-center justify-center rounded-xl border border-dashed border-line-strong text-[12px] text-fg-subtle", className)}
        style={{ height }}
      >
        No data for this period yet
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const x = (i: number) => pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - ((v - min) / span) * innerH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${(pad.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(pad.top + innerH).toFixed(1)} Z`;

  const color =
    tone === "positive" ? "var(--positive)" : tone === "negative" ? "var(--negative)" : "var(--accent)";

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`grad-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        <path d={area} fill={`url(#grad-${gradientId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

        {data.map((d, i) => (
          <g key={`${d.label}-${i}`}>
            <rect
              x={x(i) - innerW / Math.max(1, data.length) / 2}
              y={pad.top}
              width={innerW / Math.max(1, data.length)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={-1}
            />
            {hover === i ? (
              <>
                <line x1={x(i)} y1={pad.top} x2={x(i)} y2={pad.top + innerH} stroke={color} strokeOpacity="0.25" strokeDasharray="3 3" />
                <circle cx={x(i)} cy={y(d.value)} r="3.5" fill={color} />
              </>
            ) : null}
          </g>
        ))}

        {data.length <= 14
          ? data.map((d, i) => (
              <text
                key={`lbl-${i}`}
                x={x(i)}
                y={height - 5}
                textAnchor="middle"
                fontSize="9"
                fill="var(--fg-subtle)"
              >
                {d.label}
              </text>
            ))
          : null}
      </svg>

      {hover !== null ? (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-line bg-[var(--surface-strong)] px-2 py-1 text-[11px] text-fg shadow-sm">
          <span className="text-fg-subtle">{data[hover].label}</span>{" "}
          <span className="tnum font-medium">{format(data[hover].value)}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Horizontal bars for category breakdowns. */
export function BarList({
  items,
  format = (n: number) => String(n),
  max: maxProp,
  emptyLabel = "No data yet",
}: {
  items: { label: string; value: number; tone?: "accent" | "negative" | "positive" }[];
  format?: (n: number) => string;
  max?: number;
  emptyLabel?: string;
}) {
  if (!items.length) {
    return <p className="py-4 text-center text-[12px] text-fg-subtle">{emptyLabel}</p>;
  }
  const max = maxProp ?? Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item) => {
        const width = Math.max(2, (item.value / max) * 100);
        const color =
          item.tone === "negative" ? "var(--negative)" : item.tone === "positive" ? "var(--positive)" : "var(--accent)";
        return (
          <div key={item.label}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span className="truncate text-[12px] text-fg-muted">{item.label}</span>
              <span className="tnum shrink-0 text-[12px] font-medium text-fg">{format(item.value)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-subtle)]">
              <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Compact progress ring used by savings and goal widgets. */
export function ProgressRing({
  value,
  size = 44,
  stroke = 4,
  label,
}: {
  value: number | null;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label ?? `${Math.round(pct)} percent`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-subtle)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
